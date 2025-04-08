document.addEventListener('DOMContentLoaded', function() {
    console.log('Hello from login.js');


    // Google API
    const CLIENT_ID = '591484697551-u8ag6jl4829i0uaium0mktdecvj21m5i.apps.googleusercontent.com';
    const API_KEY = 'AIzaSyAZHa_rjbQqTCbQa8_4yrsvjBFlZsB5vDI';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }

    async function initializeGapiClient() {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        checkLoginStatus();
    }

    function gisLoaded() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: handleAuthResponse,
        });
        gisInited = true;
        checkLoginStatus();
    }

    function checkLoginStatus() {
        if (gapiInited && gisInited) {
            if (localStorage.getItem('access_token')) {
                const loginBtn = document.getElementById('loginBtn');
                const logoutBtn = document.getElementById('logoutBtn');
                if (loginBtn && logoutBtn) {
                    loginBtn.style.display = 'none';
                    logoutBtn.style.display = 'block';
                    document.getElementById('status').innerText = 'User is already signed in.';
                }
            } else {
                const loginBtn = document.getElementById('loginBtn');
                const logoutBtn = document.getElementById('logoutBtn');
                if (loginBtn && logoutBtn) {
                    loginBtn.style.display = 'block';
                    logoutBtn.style.display = 'none';
                    document.getElementById('status').innerText = 'User is not signed in.';
                }
            }
        }
    }

    function signIn() {
        if (!gisInited) {
            console.error("Google Identity Services not initialized.");
            alert("Google Sign-In is not ready. Please try again later.");
            return;
        }
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    function handleAuthResponse(response) {
    if (response && response.access_token) {
        console.log('Access Token:', response.access_token);
        localStorage.setItem('access_token', response.access_token);

        // Ambil informasi user dari Google API
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${response.access_token}` },
        })
        .then(res => res.json())
        .then(userInfo => {
            console.log("Google User:", userInfo);

            // Kirim data ke backend Django
            fetch("/google-login-callback/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCSRFToken()
                },
                body: JSON.stringify({
                    email: userInfo.email,
                    name: userInfo.name
                })
            })
            .then(res => res.json())
            .then(data => {
                console.log("Django Login Response:", data);
                window.location.href = "/dashboard/";  // Redirect ke dashboard
            })
            .catch(error => console.error("Google login callback failed:", error));
        })
        .catch(error => console.error("Fetching Google user info failed:", error));
    } else {
        console.error('Login failed');
    }
} 

    function signOut() {
        const token = localStorage.getItem('access_token'); // Cek apakah user login dengan Google
        
        fetch('/logout/', { method: 'POST', credentials: 'include' }) // Logout dari Django
            .then(response => response.json())
            .then(data => {
                if (data.method === "google" && token) {
                    // 1. Revoke token dari Google
                    google.accounts.oauth2.revoke(token, () => {
                        console.log('Google Access Token Revoked.');
                    });
    
                    // 2. Hapus token dari localStorage
                    localStorage.removeItem('access_token');
    
                    // 3. Logout dari sesi Google
                    google.accounts.id.disableAutoSelect();
                }
    
                // 4. Redirect ke halaman login
                window.location.href = "/login";
            })
            .catch(error => console.error('Logout failed:', error));
    }

    function logoutUser() {
        fetch("/logout", {  // Hapus trailing slash
            method: "POST",
            credentials: "include",
            headers: {
                "X-CSRFToken": getCSRFToken(),
                "Content-Type": "application/json",
            }
        })
        .then(response => response.json())  // Pastikan response berupa JSON
        .then(data => {
            console.log("Logout response:", data);
    
            if (data.status === "success") {
                window.location.href = "/login";  // Redirect ke halaman login
            } else {
                console.error("Logout failed:", data.message);
            }
        })
        .catch(error => console.error("Logout failed:", error));
    }
    
    function getCSRFToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
    }
    

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', signIn);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }

    gapiLoaded();
    gisLoaded();
});