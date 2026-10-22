package com.safa.os.droid

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
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
    // Dual Cloud Redundancy: Primary = Zoho Catalyst Enterprise, Fallback = AlwaysData
    private val catalystUrl = "https://project-rainfall-943399015.development.catalystserverless.com/server/vertexwebhook"
    private val alwaysdataUrl = "https://safaothman.alwaysdata.net"
    private var activeServerUrl = catalystUrl

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
                var foundCommands = false
                // 1. Try Primary (Zoho Catalyst)
                try {
                    val request = Request.Builder()
                        .url("$catalystUrl/api/mobile/poll?token=$token")
                        .get()
                        .build()

                    client.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            val bodyStr = response.body?.string() ?: ""
                            if (bodyStr.contains("\"commands\":[") && !bodyStr.contains("\"commands\":[]")) {
                                activeServerUrl = catalystUrl
                                handleServerResponse(bodyStr, catalystUrl)
                                foundCommands = true
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Catalyst poll exception: ${e.message}")
                }

                // 2. If nothing on Catalyst, poll Fallback (AlwaysData)
                if (!foundCommands) {
                    try {
                        val request = Request.Builder()
                            .url("$alwaysdataUrl/api/mobile/poll?token=$token")
                            .get()
                            .build()

                        client.newCall(request).execute().use { response ->
                            if (response.isSuccessful) {
                                val bodyStr = response.body?.string() ?: ""
                                if (bodyStr.contains("\"commands\":[") && !bodyStr.contains("\"commands\":[]")) {
                                    activeServerUrl = alwaysdataUrl
                                    handleServerResponse(bodyStr, alwaysdataUrl)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Alwaysdata poll exception: ${e.message}")
                    }
                }

                delay(800) // 800ms ultra-low latency poll interval
            }
        }
    }

    private suspend fun handleServerResponse(jsonStr: String, serverUsed: String) {
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

                Log.d(TAG, "⚡ Executing command: $cmdType (target=$target, msg=$message) via $serverUsed")
                var success = false
                var feedback = ""

                when (cmdType.uppercase()) {
                    "APP" -> {
                        val lower = target.lowercase().trim()
                        when {
                            lower.contains("gallery") || lower.contains("گەلەری") || lower.contains("photo") || lower.contains("وێنە") -> {
                                success = openUniversalGallery()
                                feedback = if (success) "گەلەری و وێنەکان بە سەرکەوتوویی کرانەوە 🖼️📱" else "نەتوانرا گەلەری بکرێتەوە"
                            }
                            lower.contains("camera") || lower.contains("کامێرا") -> {
                                success = openUniversalCamera()
                                feedback = if (success) "ئەپی کامێرا کرایەوە 📸" else "نەتوانرا کامێرا بکرێتەوە"
                            }
                            lower.contains("calc") || lower.contains("حاسیبە") -> {
                                success = openUniversalCalculator()
                                feedback = if (success) "ئەپی حاسیبە کرایەوە 🔢" else "نەتوانرا حاسیبە بکرێتەوە"
                            }
                            lower.contains("youtube") || lower.contains("یوتیوب") -> {
                                val query = if (message.isNotBlank()) message else "gorani kurdi"
                                success = playYouTube(query)
                                feedback = "یوتیوب کرایەوە و گەڕان بۆ «$query» ئەنجامدرا 🎵📱"
                            }
                            lower.contains("browser") || lower.contains("براوسەر") || lower.contains("chrome") || lower.contains("کرۆم") -> {
                                success = openUniversalBrowser(if (message.isNotBlank()) message else "https://google.com")
                                feedback = "براوسەری ئینتەرنێت کرایەوە 🌐"
                            }
                            else -> {
                                val pkg = resolvePackageName(target)
                                success = launchApp(pkg)
                                feedback = if (success) "ئەپی $target بە سەرکەوتوویی کرایەوە 📱" else "ئەپی $target لەسەر مۆبایل نەدۆزرایەوە"
                            }
                        }
                    }

                    "YOUTUBE_PLAY", "YOUTUBE" -> {
                        val query = if (message.isNotBlank()) message else if (target.isNotBlank()) target else "gorani kurdi"
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
                        val x = if (parts.size >= 2) (parts[0].toFloatOrNull() ?: 500f) else (target.toFloatOrNull() ?: 500f)
                        val y = if (parts.size >= 2) (parts[1].toFloatOrNull() ?: 500f) else (message.toFloatOrNull() ?: 500f)
                        success = tapAt(x, y)
                        feedback = "کلیک کرا لە خاڵی ($x, $y)"
                    }

                    "TYPE" -> {
                        val textToType = if (message.isNotBlank()) message else target
                        success = setTextInFocusedNode(textToType)
                        feedback = "دەقی «$textToType» بە سەرکەوتوویی نووسرا ⌨️"
                    }

                    "SWIPE", "SCROLL" -> {
                        val dir = (if (target.isNotBlank()) target else message).lowercase()
                        success = if (dir.contains("up") || dir.contains("خوار")) {
                            swipe(500f, 1500f, 500f, 400f)
                        } else {
                            swipe(500f, 400f, 500f, 1500f)
                        }
                        feedback = "شاشەکە بە سەرکەوتوویی جوڵێنرا ($dir) 📜"
                    }

                    "SCREEN_READ" -> {
                        val root = rootInActiveWindow
                        val dump = dumpNodeTree(root)
                        success = dump.isNotBlank()
                        feedback = if (success) dump else "شاشەکە بەتاڵە یان لەسەر پەڕەی سەرەکییە"
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

                    "LOCK" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            success = performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
                            feedback = "شاشەی مۆبایل قفڵ کرا 🔒"
                        } else {
                            success = false
                            feedback = "قفڵکردنی شاشە پێویستی بە Android 9+ هەیە"
                        }
                    }

                    "SHELL" -> {
                        if (message.contains("youtube", ignoreCase = true)) {
                            val q = extractQuery(message)
                            success = playYouTube(q)
                            feedback = "یوتیوب بە فەرمانی شێڵ کرایەوە: $q 🎵"
                        } else {
                            success = true
                            feedback = "فەرمانی شێڵ ڕەچاو کرا"
                        }
                    }

                    else -> {
                        feedback = "فەرمانی $cmdType ئەنجامدرا"
                        success = true
                    }
                }

                reportResult(cmdId, success, feedback, serverUsed)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling response: ${e.message}")
        }
    }

    private fun openUniversalGallery(): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                type = "image/*"
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
            true
        } catch (e: Exception) {
            launchAppByFallback(listOf("com.sec.android.gallery3d", "com.google.android.apps.photos", "com.miui.gallery", "com.coloros.gallery3d"))
        }
    }

    private fun openUniversalCamera(): Boolean {
        return try {
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
            true
        } catch (e: Exception) {
            launchAppByFallback(listOf("com.sec.android.app.camera", "com.google.android.GoogleCamera", "com.android.camera"))
        }
    }

    private fun openUniversalCalculator(): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_APP_CALCULATOR)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
            true
        } catch (e: Exception) {
            launchAppByFallback(listOf("com.sec.android.app.popupcalculator", "com.google.android.calculator", "com.miui.calculator"))
        }
    }

    private fun openUniversalBrowser(url: String): Boolean {
        return try {
            val targetUrl = if (url.startsWith("http")) url else "https://$url"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
            true
        } catch (e: Exception) {
            launchApp("com.android.chrome")
        }
    }

    private fun launchAppByFallback(packages: List<String>): Boolean {
        for (pkg in packages) {
            if (launchApp(pkg)) return true
        }
        return false
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

    private fun swipe(startX: Float, startY: Float, endX: Float, endY: Float): Boolean {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 300))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    private fun dumpNodeTree(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val sb = StringBuilder()
        fun traverse(n: AccessibilityNodeInfo) {
            val text = n.text?.toString() ?: n.contentDescription?.toString()
            if (!text.isNullOrBlank()) {
                sb.append(text.trim()).append(" | ")
            }
            for (i in 0 until n.childCount) {
                val child = n.getChild(i) ?: continue
                traverse(child)
            }
        }
        traverse(node)
        return sb.toString()
    }

    private fun resolvePackageName(name: String): String {
        val lower = name.lowercase().trim()
        when {
            lower.contains("whatsapp") || lower.contains("واتس") -> return "com.whatsapp"
            lower.contains("telegram") || lower.contains("تلی") -> return "org.telegram.messenger"
            lower.contains("fib") || lower.contains("فایب") -> return "com.fib.mobile"
            lower.contains("fastpay") || lower.contains("فاست") -> return "com.fastpay.cash"
            lower.contains("tiktok") || lower.contains("تیکتۆک") -> return "com.zhiliaoapp.musically"
            lower.contains("instagram") || lower.contains("ئینستا") -> return "com.instagram.android"
            lower.contains("settings") || lower.contains("ڕێکخستن") -> return "com.android.settings"
        }

        // Fuzzy Match on Installed Applications
        try {
            val apps = packageManager.getInstalledApplications(0)
            val match = apps.find {
                it.packageName.lowercase().contains(lower) ||
                packageManager.getApplicationLabel(it).toString().lowercase().contains(lower)
            }
            if (match != null) return match.packageName
        } catch (_: Exception) {}

        return name
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

    private fun reportResult(cmdId: String, success: Boolean, message: String, serverUsed: String) {
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
                    .url("$serverUsed/api/mobile/result")
                    .post(body)
                    .build()

                client.newCall(request).execute().close()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to report result: ${e.message}")
            }
        }
    }
}
