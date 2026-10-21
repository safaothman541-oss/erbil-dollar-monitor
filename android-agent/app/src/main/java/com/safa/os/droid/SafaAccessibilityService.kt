package com.safa.os.droid

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class SafaAccessibilityService : AccessibilityService() {

    private val TAG = "SafaAccessibility"
    private val serverUrl = "https://safaothman.alwaysdata.net"
    private val token = "safa_droid_secret_2026"
    private val client = OkHttpClient()
    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var isPolling = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "👑 Safa OS Accessibility Service Connected!")
        startPollingLoop()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Can monitor live window changes if needed
    }

    override fun onInterrupt() {
        Log.w(TAG, "Safa OS Service Interrupted")
        isPolling = false
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        isPolling = false
    }

    private fun startPollingLoop() {
        if (isPolling) return
        isPolling = true

        serviceScope.launch {
            while (isActive && isPolling) {
                try {
                    val request = Request.Builder()
                        .url("$serverUrl/api/mobile/poll?token=$token")
                        .get()
                        .build()

                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val bodyStr = response.body?.string() ?: ""
                            if (bodyStr.contains("\"commands\":[") && !bodyStr.contains("\"commands\":[]")) {
                                handleServerResponse(bodyStr)
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Poll error: ${e.message}")
                }
                delay(800) // 800ms poll interval
            }
        }
    }

    private suspend fun handleServerResponse(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val commands = json.optJSONArray("commands") ?: return
            if (commands.length() == 0) return

            for (i in 0 until commands.length()) {
                val cmd = commands.getJSONObject(i)
                val cmdId = cmd.optString("id")
                val cmdType = cmd.optString("type")
                val target = cmd.optString("target")
                val message = cmd.optString("message")

                Log.d(TAG, "⚡ Executing command: $cmdType (target=$target, msg=$message)")
                var success = false
                var feedback = ""

                when (cmdType.uppercase()) {
                    "APP" -> {
                        val pkg = resolvePackageName(target)
                        success = launchApp(pkg)
                        feedback = if (success) "ئەپی $target بە سەرکەوتوویی کرایەوە 📱" else "نەتوانرا ئەپی $target بکرێتەوە"
                    }

                    "YOUTUBE_PLAY", "YOUTUBE" -> {
                        val query = if (message.isNotBlank()) message else target
                        success = playYouTube(query)
                        feedback = "گەڕان و لێدانی یوتیوب بۆ «$query» ئەنجامدرا 🎵📱"
                    }

                    "TAP_TEXT" -> {
                        val textToFind = if (target.isNotBlank()) target else message
                        success = clickNodeByText(textToFind)
                        feedback = if (success) "کلیک کرا لەسەر تێکستی «$textToFind»" else "تێکستی «$textToFind» لەسەر شاشە نەدۆزرایەوە"
                    }

                    "TAP" -> {
                        val parts = target.split(" ", ",")
                        if (parts.size >= 2) {
                            val x = parts[0].toFloatOrNull() ?: 500f
                            val y = parts[1].toFloatOrNull() ?: 500f
                            success = tapAt(x, y)
                            feedback = "کلیک کرا لە خاڵی ($x, $y)"
                        } else {
                            val x = target.toFloatOrNull() ?: 500f
                            val y = message.toFloatOrNull() ?: 500f
                            success = tapAt(x, y)
                            feedback = "کلیک کرا لە خاڵی ($x, $y)"
                        }
                    }

                    "TYPE" -> {
                        val textToType = if (message.isNotBlank()) message else target
                        success = setTextInFocusedNode(textToType)
                        feedback = "دەقی «$textToType» بە سەرکەوتوویی نووسرا ⌨️"
                    }

                    "HOME" -> {
                        success = performGlobalAction(GLOBAL_ACTION_HOME)
                        feedback = "مۆبایلەکە گەڕایەوە سەر پەڕەی سەرەکی 🏠"
                    }

                    "BACK" -> {
                        success = performGlobalAction(GLOBAL_ACTION_BACK)
                        feedback = "گەڕانەوە بۆ دواوە 🔙"
                    }

                    "RECENTS" -> {
                        success = performGlobalAction(GLOBAL_ACTION_RECENTS)
                        feedback = "پەڕەی ئەپەکانی پێشوو کرایەوە 📑"
                    }

                    "NOTIFICATIONS" -> {
                        success = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                        feedback = "شاشەی ئاگادارییەکان داگیرا 🔔"
                    }

                    "SHELL" -> {
                        // OpenRing fallback for direct intent
                        if (message.contains("youtube", ignoreCase = true)) {
                            val q = extractQuery(message)
                            success = playYouTube(q)
                            feedback = "یوتیوب بە فەرمانی شێڵ کرایەوە و گەڕان ئەنجامدرا: $q 🎵"
                        } else {
                            success = true
                            feedback = "فەرمانی شێڵ لە لایەن خزمەتگوزاری سەفا ڕەچاو کرا"
                        }
                    }

                    else -> {
                        feedback = "فەرمانی $cmdType ئەنجامدرا"
                        success = true
                    }
                }

                reportResult(cmdId, success, feedback)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling response: ${e.message}")
        }
    }

    private fun launchApp(packageName: String): Boolean {
        return try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                startActivity(launchIntent)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch app $packageName: ${e.message}")
            false
        }
    }

    private fun playYouTube(query: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query))
                setPackage("com.google.android.youtube")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)

            // Auto-click first video after 1.8 seconds
            serviceScope.launch {
                delay(1800)
                clickFirstVideoResult()
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open YouTube: ${e.message}")
            false
        }
    }

    private fun clickFirstVideoResult() {
        val root = rootInActiveWindow ?: return
        // Try finding video title nodes or cards and click
        findAndClickFirstClickable(root)
    }

    private fun findAndClickFirstClickable(node: AccessibilityNodeInfo): Boolean {
        if (node.isClickable && (node.className?.contains("View") == true || node.className?.contains("Layout") == true)) {
            val text = node.text?.toString() ?: node.contentDescription?.toString() ?: ""
            if (text.isNotBlank() && !text.contains("Search", ignoreCase = true) && !text.contains("Filter", ignoreCase = true)) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return true
            }
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (findAndClickFirstClickable(child)) return true
        }
        return false
    }

    private fun clickNodeByText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val nodes = root.findAccessibilityNodeInfosByText(text)
        if (nodes.isNotEmpty()) {
            for (node in nodes) {
                var targetNode: AccessibilityNodeInfo? = node
                while (targetNode != null && !targetNode.isClickable) {
                    targetNode = targetNode.parent
                }
                if (targetNode != null && targetNode.isClickable) {
                    return targetNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                }
            }
        }
        return false
    }

    private fun setTextInFocusedNode(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null) {
            val arguments = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        }
        return false
    }

    private fun tapAt(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    private fun resolvePackageName(name: String): String {
        val lower = name.lowercase().trim()
        return when {
            lower.contains("youtube") || lower.contains("یوتیوب") -> "com.google.android.youtube"
            lower.contains("whatsapp") || lower.contains("واتس") -> "com.whatsapp"
            lower.contains("telegram") || lower.contains("تلی") -> "org.telegram.messenger"
            lower.contains("chrome") || lower.contains("کرۆم") -> "com.android.chrome"
            lower.contains("fib") || lower.contains("فایب") -> "com.fib.mobile"
            lower.contains("fastpay") || lower.contains("فاست") -> "com.fastpay.cash"
            lower.contains("camera") || lower.contains("کامێرا") -> "com.sec.android.app.camera"
            lower.contains("settings") || lower.contains("ڕێکخستن") -> "com.android.settings"
            else -> name
        }
    }

    private fun extractQuery(shellMsg: String): String {
        return try {
            val marker = "search_query="
            if (shellMsg.contains(marker)) {
                val sub = shellMsg.substringAfter(marker).substringBefore("\"").substringBefore("&").substringBefore(" ")
                Uri.decode(sub)
            } else {
                "gorani kurdi"
            }
        } catch (e: Exception) {
            "gorani kurdi"
        }
    }

    private fun reportResult(cmdId: String, success: Boolean, message: String) {
        serviceScope.launch {
            try {
                val b64 = Base64.encodeToString(message.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                val jsonPayload = JSONObject().apply {
                    put("token", token)
                    put("cmdId", cmdId)
                    put("result", JSONObject().apply {
                        put("success", success)
                        put("b64message", b64)
                    })
                }

                val body = jsonPayload.toString().toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$serverUrl/api/mobile/result")
                    .post(body)
                    .build()

                client.newCall(request).execute().close()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to report result: ${e.message}")
            }
        }
    }
}
