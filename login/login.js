async function getStravaTokens(secret, code) {
    const response = await fetch(`https://www.strava.com/oauth/token?client_id=91780&client_secret=${secret}&code=${code}&grant_type=authorization_code`, {method: 'POST'});
    return response.json();
}

window.onload = () => {
    const discCode = localStorage.getItem('disc_code');
    if (discCode !== null && window.location.href.split('code=').length > 1) {
        const responseCode = window.location.href.split('code=')[1].split('&scope')[0];
        getStravaTokens(discCode, responseCode).then(data => {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('access_expires', data.expires_at);
            window.location.href = 'https://sbwildflowers.com/strava-disc-golf/'
        });
    } else {
        const errorDiv = document.querySelector('.error');
        errorDiv.classList.add('show')
    }
}
