window.onload = () => {
    const textBox = document.querySelector('input');
    // if user has a code already stored in local storage place it into the text box
    if (localStorage.getItem('disc_code') !== null) {
        textBox.value = localStorage.getItem('disc_code');
    }

    const loginButton = document.querySelector('button');
    loginButton.onclick = () => {
        // make sure user has entered something into the code input
        if (textBox.value === '') {
            const error = document.querySelector('.error');
            error.classList.add('show');
        } else {
            localStorage.setItem('disc_code', textBox.value);
            window.location.href = 'http://www.strava.com/oauth/authorize?client_id=91780&response_type=code&redirect_uri=http://localhost:9000/login_handler.html&approval_prompt=force&scope=activity:read'
        }
    }
}