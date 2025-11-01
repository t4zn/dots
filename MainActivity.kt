package com.taizun.dotsandboxes

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    private var backPressedTime: Long = 0
    private lateinit var backToast: Toast

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Enable immersive full-screen mode
        enableImmersiveMode()
        
        // Lock orientation to portrait for better game experience
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        
        // Keep screen on during gameplay
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        setupWebView()
        setContentView(webView)
        
        // Load the game
        loadGame()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this)
        
        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            
            // Enable hardware acceleration for better performance
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            
            // Disable text selection for better game experience
            setTextZoom(100)
        }
        
        // Set WebView client to handle page loading
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false // Let WebView handle all URLs
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Hide system UI after page loads
                hideSystemUI()
            }
            
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                showToast("Failed to load game. Please check your internet connection.")
            }
        }
        
        // Set WebChrome client for better JavaScript support
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                // Log JavaScript console messages for debugging
                consoleMessage?.let {
                    android.util.Log.d("WebView", "${it.message()} -- From line ${it.lineNumber()} of ${it.sourceId()}")
                }
                return true
            }
            
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                // Handle JavaScript alerts
                showToast(message ?: "Alert")
                result?.confirm()
                return true
            }
        }
        
        // Add JavaScript interface for native functionality
        webView.addJavaScriptInterface(GameInterface(this), "Android")
    }
    
    private fun loadGame() {
        // Load your game - you can either load from assets or from a URL
        // Option 1: Load from assets (recommended for offline play)
        webView.loadUrl("file:///android_asset/index.html")
        
        // Option 2: Load from your website (requires internet)
        // webView.loadUrl("https://dots.taizun.site")
    }
    
    private fun enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
    
    private fun hideSystemUI() {
        webView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }
    
    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            // Double tap to exit
            if (backPressedTime + 2000 > System.currentTimeMillis()) {
                backToast.cancel()
                super.onBackPressed()
                return
            } else {
                backToast = Toast.makeText(baseContext, "Press back again to exit", Toast.LENGTH_SHORT)
                backToast.show()
            }
            backPressedTime = System.currentTimeMillis()
        }
    }
    
    override fun onResume() {
        super.onResume()
        webView.onResume()
        hideSystemUI()
    }
    
    override fun onPause() {
        super.onPause()
        webView.onPause()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
    
    // JavaScript Interface for native Android functionality
    inner class GameInterface(private val context: Context) {
        
        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
        
        @JavascriptInterface
        fun vibrate(duration: Long = 50) {
            runOnUiThread {
                try {
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        vibrator.vibrate(android.os.VibrationEffect.createOneShot(duration, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(duration)
                    }
                } catch (e: Exception) {
                    // Vibration not supported or permission not granted
                }
            }
        }
        
        @JavascriptInterface
        fun keepScreenOn(keep: Boolean) {
            runOnUiThread {
                if (keep) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }
        
        @JavascriptInterface
        fun shareRoomCode(roomCode: String) {
            runOnUiThread {
                val shareIntent = android.content.Intent().apply {
                    action = android.content.Intent.ACTION_SEND
                    type = "text/plain"
                    putExtra(android.content.Intent.EXTRA_TEXT, "Join my Dots & Boxes game! Room code: $roomCode")
                    putExtra(android.content.Intent.EXTRA_SUBJECT, "Dots & Boxes - Join Game")
                }
                startActivity(android.content.Intent.createChooser(shareIntent, "Share Room Code"))
            }
        }
        
        @JavascriptInterface
        fun copyToClipboard(text: String) {
            runOnUiThread {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("Room Code", text)
                clipboard.setPrimaryClip(clip)
                showToast("Room code copied!")
            }
        }
        
        @JavascriptInterface
        fun getDeviceInfo(): String {
            return android.os.Build.MODEL
        }
        
        @JavascriptInterface
        fun isNetworkAvailable(): Boolean {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            val activeNetwork = connectivityManager.activeNetworkInfo
            return activeNetwork?.isConnectedOrConnecting == true
        }
    }
}