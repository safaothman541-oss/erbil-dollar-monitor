package com.safa.os.droid

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var btnEnable: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        btnEnable = findViewById(R.id.btnEnable)

        btnEnable.setOnClickListener {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun updateStatus() {
        val isEnabled = isAccessibilityServiceEnabled(this, SafaAccessibilityService::class.java)
        if (isEnabled) {
            tvStatus.text = "✅ دۆخ: خزمەتگوزاری Safa OS کارایە و ئامادەیە!"
            tvStatus.setTextColor(android.graphics.Color.GREEN)
            btnEnable.text = "خزمەتگوزاری چالاککراوە"
            btnEnable.isEnabled = false
        } else {
            tvStatus.text = "⚠️ دۆخ: تکایە لە ڕێکخستن چالاکی بکە"
            tvStatus.setTextColor(android.graphics.Color.RED)
            btnEnable.text = "کردنەوەی ڕێکخستنی Accessibility"
            btnEnable.isEnabled = true
        }
    }

    private fun isAccessibilityServiceEnabled(context: Context, serviceClass: Class<*>): Boolean {
        val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_GENERIC)
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.name == serviceClass.name) {
                return true
            }
        }
        return false
    }
}
