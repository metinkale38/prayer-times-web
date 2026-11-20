# Android WebView integration

The WebApp is designed to run unchanged inside an Android `WebView`. Two small
native bridges replace the browser implementations:

| JS adapter | Native bridge | Why |
|---|---|---|
| `LocalStorageAdapter` | `PrayerTimesAndroid.getString/...` | persistence in `SharedPreferences`/Room |
| `BrowserHttpAdapter` | `PrayerTimesAndroid.httpGet(url)` | the public API only allows the GitHub Pages origin |

`js/core/storage.js` and `js/core/http.js` detect these methods automatically.
The browser fallbacks remain in place for normal hosting.

## Files

Copy the static WebApp files (`index.html`, `*.html`, `css/`, `js/`, `data/`,
`assets/`, `partials/`, `manifest.webmanifest`, `sw.js`) into
`app/src/main/assets/prayer-times-web/` (or serve them from your own asset path).
Load the entry point from a stable HTTPS-like origin:

```kotlin
val assetLoader = WebViewAssetLoader.Builder()
    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
    .build()

webView.webViewClient = object : WebViewClientCompat() {
    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
}

webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    allowFileAccess = false
    allowContentAccess = false
}

webView.addJavascriptInterface(PrayerTimesBridge(context), "PrayerTimesAndroid")
webView.loadUrl("https://appassets.androidplatform.net/assets/prayer-times-web/index.html")
```

Using `WebViewAssetLoader` instead of `file:///android_asset` gives the page a
normal HTTPS origin, so ES modules and `fetch` work. API calls still go through
the native HTTP bridge because the API's CORS allowlist only contains the GitHub
Pages origin.

## Bridge

```kotlin
import android.content.Context
import android.webkit.JavascriptInterface
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

class PrayerTimesBridge(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("prayer_times_webapp", Context.MODE_PRIVATE)
    private val http = OkHttpClient()

    @JavascriptInterface
    fun getString(key: String): String? = prefs.getString(key, null)

    @JavascriptInterface
    fun setString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    @JavascriptInterface
    fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    @JavascriptInterface
    fun keys(): String = JSONArray(prefs.all.keys.toList()).toString()

    /**
     * Runs on a WebView background thread. Keep the call synchronous so the
     * @JavascriptInterface return value can be awaited directly in JS.
     */
    @JavascriptInterface
    fun httpGet(url: String): String {
        require(url.startsWith("https://opt.mk38.de/")) { "Unexpected API host" }
        val request = Request.Builder().url(url).get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            return response.body?.string() ?: error("Empty body")
        }
    }
}
```

If you prefer a nested object, expose the same methods under
`PrayerTimesAndroid.storage`; the JS adapter accepts both shapes.

## Notifying JS about native changes

The JS `Storage.subscribe` uses `window.__ptStorageChanged(key)`. If a native
component changes a stored value, call:

```kotlin
webView.evaluateJavascript("window.__ptStorageChanged && window.__ptStorageChanged(${JSONObject.quote(key)})", null)
```

## Key space

The JS layer writes keys such as:

```text
pt:v1:settings
pt:v1:cities
pt:v1:dhikr
pt:v1:times:Diyanet:11010
pt:v1:city:Diyanet:11010
```

Treat them as opaque. Do not rename or rewrite the JSON envelope
(`{"v":1,"data":...}`) unless you also migrate the JS storage version.

## Offline

The WebApp itself is fully local. The built-in service worker is optional inside
a WebView; `WebViewAssetLoader` already serves the shell offline. Prayer times
are cached in the storage bridge, so the last synced city remains available
without a network connection.
