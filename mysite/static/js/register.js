document.addEventListener('DOMContentLoaded', function() {
    console.log('Hello from main.js');
    // Validasi nomor HP
    function validatePhone(input) {
        input.value = input.value.replace(/[^0-9]/g, '').slice(0, 12);
        const phoneError = document.getElementById('phone-error');
        phoneError.classList.toggle('hidden', input.value.length > 0);
    }

    // Validasi form
    function validateForm(event) {
        event.preventDefault(); // Mencegah submit default

        const usernameField = document.getElementById("username");
        const usernameError = document.getElementById("username-error");
        const emailField = document.getElementById("email");
        const emailError = document.getElementById("email-error");
        const passwordField = document.getElementById("password");
        const passwordError = document.getElementById("password-error");
        const phoneField = document.getElementById("phone");
        const phoneError = document.getElementById("phone-error");

        // Validasi username
        const usernamePattern = /^[a-zA-Z0-9_]{3,}$/;
        const isValidUsername = usernamePattern.test(usernameField.value.trim());
        usernameError.classList.toggle("hidden", isValidUsername);

        // Validasi email
        const emailPattern = /^[a-zA-Z0-9._%+-]+@student\.ce\.undip\.ac\.id$/;
        const isValidEmail = emailPattern.test(emailField.value);
        emailError.classList.toggle("hidden", isValidEmail);

        // Validasi password
        const isValidPassword = passwordField.value.length >= 8;
        passwordError.classList.toggle("hidden", isValidPassword);

        // Validasi nomor HP
        const isValidPhone = phoneField.value.length > 0;
        phoneError.classList.toggle("hidden", isValidPhone);

        if (!isValidUsername || !isValidEmail || !isValidPassword || !isValidPhone) {
            return false; // Stop submit jika ada error
        }

        // Jika validasi berhasil, submit form
        event.target.submit();
    }

    // Validasi real-time untuk username
    function validateUsername() {
        const usernameField = document.getElementById("username");
        const usernameError = document.getElementById("username-error");

        fetch(`/check_username?username=${usernameField.value}`)
            .then(response => response.json())
            .then(data => {
                if (data.exists) {
                    usernameError.textContent = "Username sudah digunakan";
                    usernameError.classList.remove("hidden");
                } else {
                    usernameError.classList.add("hidden");
                }
            })
            .catch(error => console.error("Error checking username:", error));
    }

    // Validasi real-time untuk email
    function validateEmail() {
        const emailField = document.getElementById("email");
        const emailError = document.getElementById("email-error");

        fetch(`/check_email?email=${emailField.value}`)
            .then(response => response.json())
            .then(data => {
                if (data.exists) {
                    emailError.textContent = "Email sudah digunakan";
                    emailError.classList.remove("hidden");
                } else {
                    emailError.classList.add("hidden");
                }
            })
            .catch(error => console.error("Error checking email:", error));
    }

    // Tambahkan event listener ke form
    const form = document.querySelector("form");
    if (form) {
        form.addEventListener("submit", validateForm);
    }

    // Tambahkan event listener untuk validasi nomor HP
    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
        phoneInput.addEventListener("input", function () {
            validatePhone(this);
        });
    }

    // Tambahkan event listener untuk validasi real-time username
    const usernameInput = document.getElementById("username");
    if (usernameInput) {
        usernameInput.addEventListener("blur", validateUsername);
    }

    // Tambahkan event listener untuk validasi real-time email
    const emailInput = document.getElementById("email");
    if (emailInput) {
        emailInput.addEventListener("blur", validateEmail);
    }

});