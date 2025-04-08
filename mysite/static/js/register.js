document.addEventListener('DOMContentLoaded', function() {
    console.log('Hello from register.js');
    // Validasi nomor HP
    function validatePhone(input) {
        input.value = input.value.replace(/[^0-9]/g, '').slice(0, 12);
        const phoneError = document.getElementById('phone-error');
        phoneError.classList.toggle('hidden', input.value.length > 0);
    }

    // Validasi form
    async function validateForm(event) {
        event.preventDefault(); // Cegah submit langsung
    
        const usernameField = document.getElementById("username");
        const usernameError = document.getElementById("username-error");
    
        const emailField = document.getElementById("email");
        const emailError = document.getElementById("email-error");
    
        const passwordField = document.getElementById("password");
        const passwordError = document.getElementById("password-error");
    
        const phoneField = document.getElementById("phone");
        const phoneError = document.getElementById("phone-error");

        let isValid = true;
    
        // Validasi username
        const usernamePattern = /^[a-zA-Z0-9_]{3,}$/;
        if (!usernamePattern.test(usernameField.value.trim())) {
            usernameError.textContent = "Format username salah! Hanya huruf, angka, dan _ dengan minimal 3 karakter.";
            usernameError.classList.remove("hidden");
            isValid = false;
        } else {
            usernameError.classList.add("hidden");
        }

        // Validasi email
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(emailField.value.trim())) {
            emailError.textContent = "Gunakan Email yang Valid (contoh: user@example.com)";
            emailError.classList.remove("hidden");
            isValid = false;
        } else {
            emailError.classList.add("hidden");
        }

        // Validasi password
        const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&_-])[A-Za-z\d@$!%*?&_-]{8,}$/;
        if (!passwordPattern.test(passwordField.value)) {
            passwordError.textContent = "Password harus minimal 8 karakter, mengandung huruf, angka, dan simbol @ $ ! % * ? & _ -";
            passwordError.classList.remove("hidden");
            isValid = false;
        } else {
            passwordError.classList.add("hidden");
        }

        // Validasi nomor HP
        if (phoneField.value.length === 0) {
            phoneError.textContent = "Nomor hanya boleh angka (max 12 digit)";
            phoneError.classList.remove("hidden");
            isValid = false;
        } else {
            phoneError.classList.add("hidden");
        }

        // Submit jika valid
        if (isValid) {
            event.target.submit();
        }
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
        const email = emailField.value.trim();

        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isValidEmail = emailPattern.test(email);

        if (!isValidEmail) {
            emailError.textContent = "Gunakan Email yang Valid!";
            emailError.classList.remove("hidden");
            return;
        }

        fetch(`/check_email?email=${email}`)
            .then(response => response.json())
            .then(data => {
                if (data.exists) {
                    emailError.textContent = "Email sudah digunakan!";
                    emailError.classList.remove("hidden");
                } else {
                    emailError.classList.add("hidden");
                }
            })
            .catch(error => console.error("Error checking email:", error));
    }
    

    // event listener
    const form = document.querySelector("form");
    if (form) {
        form.addEventListener("submit", validateForm);
    }

    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
        phoneInput.addEventListener("input", function () {
            validatePhone(this);
        });
    }

    const usernameInput = document.getElementById("username");
    if (usernameInput) {
        usernameInput.addEventListener("blur", validateUsername);
    }

    const emailInput = document.getElementById("email");
    if (emailInput) {
        emailInput.addEventListener("blur", validateEmail);
    }

});