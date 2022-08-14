// check if user is logged in - returns true or false
function loggedIn() {
    if (localStorage.getItem('access_token') !== null) {
        return true;
    } else {
        return false;
    }
}

// if access token is within 5 minutes of expiring, return true
function accessTokenExpired() {
    const expires = localStorage.getItem('access_expires');
    const now = Math.floor((new Date).getTime()/1000);
    if (now > (expires-300)) {
        return true;
    } else {
        return false;
    }
}

async function refreshAccess(secret, refresh) {
    const response = await fetch(`https://www.strava.com/oauth/token?client_id=91780&client_secret=${secret}&refresh_token=${refresh}&grant_type=refresh_token`, {method: 'POST'});
    return response.json();
}

async function getActivities(page, token) {
    const lastFetch = localStorage.getItem('last_fetch');
    if (lastFetch !== null) {
        url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200&after=${lastFetch}`;
    } else {
        url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`;
    }
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.json();
}

async function fetchData() {
    const resultsWrapper = document.querySelector('#results');
    const spinner = document.getElementById('spinner');
    const accessToken = localStorage.getItem('access_token');
    spinner.classList.add('show');
    let emptyPage = false;
    let page = 1;
    let allActivities = [];
    while (emptyPage === false) {
        const activities = await getActivities(page, accessToken);
        // activities = [1, 1];
        if (activities.length === 0) {
            emptyPage = true;
        } else {
            allActivities = allActivities.concat(activities);
            page += 1;
        }
    }
    spinner.classList.remove('show');
    // save last fetch and cache items so we don't have to do this ridiculously long pull again
    localStorage.setItem('last_fetch', Math.floor((new Date).getTime()/1000));
    console.log(allActivities);
    
}

window.onload = () => {
    const discCode = localStorage.getItem('disc_code');
    // if user isn't logged-in, pop-up the modal
    if (loggedIn() === false) {
        const textBox = document.querySelector('input.secret');
        const loginModal = document.querySelector('login');
        loginModal.classList.add('show');
        const loginButton = document.querySelector('login button.submit');
        // if user has a code already stored in local storage place it into the text box
        if (discCode !== null) {
            textBox.value = discCode;
        } else {
            loginButton.disabled = true;
        }

        const inputHandler = function(e) {
            if (e.target.value === '') {
                loginButton.disabled = true;
            } else {
                loginButton.disabled = false;
            }
        }
          
        textBox.addEventListener('input', inputHandler);

        loginButton.onclick = () => {
            // make sure user has entered something into the code input
            if (textBox.value === '') {
                
            } else {
                localStorage.setItem('disc_code', textBox.value);
                window.location.href = 'http://www.strava.com/oauth/authorize?client_id=91780&response_type=code&redirect_uri=http://localhost:9000/login&approval_prompt=force&scope=activity:read';
            }
        }
    } else {
        if (accessTokenExpired() === true) {
            const refreshToken = localStorage.getItem('refresh_token');
            refreshAccess(discCode, refreshToken).then(data => {
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                localStorage.setItem('access_expires', data.expires_at);
                fetchData();
            });
        } else {
            fetchData();
        }
    }
}