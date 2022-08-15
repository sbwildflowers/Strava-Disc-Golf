// check if user is logged in - returns true or false
function loggedIn() {
    if (localStorage.getItem('access_token') !== null) {
        return true;
    } else {
        return false;
    }
}

// if access token is within 10 minutes of expiring, return true
function accessTokenExpired() {
    const expires = localStorage.getItem('access_expires');
    const now = Math.floor((new Date).getTime()/1000);
    if (now > (expires-600)) {
        return true;
    } else {
        return false;
    }
}

// refreshes access_token
async function refreshAccess(secret, refresh) {
    const response = await fetch(`https://www.strava.com/oauth/token?client_id=91780&client_secret=${secret}&refresh_token=${refresh}&grant_type=refresh_token`, {method: 'POST'});
    return response.json();
}

// gets called iteratively by page to find all results
// if this iteration has been run before, use "after=[epoch]" so that we are only pulling new results
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

// needed to get activity descriptions where hole tuples are stored by convention
async function getActivityById(id, token) {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.json();
}

// talks to Strava and builds cache in local storage of revelant disc golf activites based on naming convention
// sadly the activites end point is garbage and has no filter and returns 50 fields by default :`| so this takes a while
async function fetchData() {
    const spinner = document.getElementById('spinner');
    const accessToken = localStorage.getItem('access_token');
    spinner.classList.add('show');
    let emptyPage = false;
    let page = 1;
    let allActivities = [];

    // page through activities end point and get results until empty is returned
    while (emptyPage === false) {
        const activities = await getActivities(page, accessToken);
        if (activities.length === 0) {
            emptyPage = true;
        } else {
            allActivities = allActivities.concat(activities);
            page += 1;
        }
    }
    spinner.classList.remove('show');

    // save last fetch and cache items in localStorage so we don't have to do this ridiculously long pull again
    discGolfActivities = [];
    localStorage.setItem('last_fetch', Math.floor((new Date).getTime()/1000));
    for (const activity of allActivities) {
        if (activity['name'].startsWith('[DG') === true) {
            const id = activity.id;
            const name = activity.name;
            const elapsedTime = activity.elapsed_time;
            const date = activity.start_date_local;
            const thisActivity = await getActivityById(id, accessToken);
            if ('description' in thisActivity) {
                var description = thisActivity.description;
            } else {
                var description = '';
            }
            activityObj = {
                'name': name,
                'elapsedTime': elapsedTime,
                'date': date,
                'description': description
            }
            discGolfActivities.push(activityObj)
        }
    }
    const activityCache = localStorage.getItem('activity_cache');
    if (activityCache !== null) {
        const cache = JSON.parse(activityCache);
        const newCache = cache.concat(discGolfActivities);
        localStorage.setItem('activity_cache', JSON.stringify(newCache));
    } else {
        localStorage.setItem('activity_cache', JSON.stringify(discGolfActivities));
    }
}

// takes a tuple in string form and returns a json object
function parseTupleString(tuple) {
    tuple = tuple.replaceAll('+','');
    tuple = tuple.replaceAll('(', '[');
    tuple = tuple.replaceAll(')', ']');
    tuple = `[${tuple}]`;
    return JSON.parse(tuple);
}

// filters list to only unique items
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

// takes a Strava title and gets course name using convention
function extractCourseName(title) {
    const parts = title.split('[DG - ');
    const course = parts[1].split(']')[0];
    return course;
}

// given a group of activites, return a bunch of calculated totals
function processTotals(activities) {
    let totalNineRounds = 0;
    let totalEighteenRounds = 0;
    let bestNineScore = 999;
    let worstNineScore = -999;
    let bestEighteenScore = 999;
    let worstEighteenScore = -999;
    let allNineRounds = [];
    let allEighteenRounds = [];
    for (const activity of activities) {
        if ('description' in activity) {
            // process rounds played
            roundsObj = parseTupleString(activity.description);
            for (round of roundsObj) {
                score = round.reduce((a,b) => b + a);
                if (round.length === 9) {
                    allNineRounds.push(round);
                    totalNineRounds += 1;
                    if (score < bestNineScore) {
                        bestNineScore = score; 
                    }
                    if (score > worstNineScore) {
                        worstNineScore = score;
                    }
                } else if (round.length === 18) {
                    allEighteenRounds.push(round);
                    totalEighteenRounds += 1;
                    if (score < bestEighteenScore) {
                        bestEighteenScore = score; 
                    }
                    if (score > bestEighteenScore) {
                        worstEighteenScore = score;
                    }
                }
            }
        }
    }
    return { 
        '9 Hole Rounds': totalNineRounds,  
        '9 Hole Best': (bestNineScore !== 999) ? bestNineScore : 'None', 
        '9 Hole Worst': (worstNineScore !== -999) ? worstNineScore : 'None',
        '18 Hole Rounds': totalEighteenRounds,
        '18 Hole Best': (bestEighteenScore !== 999) ? bestEighteenScore : 'None', 
        '18 Hole Worst': (worstEighteenScore !== -999) ? worstEighteenScore : 'None',
    };
}

function buildChart(chartId, scores) {
    const scoresWithLabels = ['Scores'].concat(scores);
    var chart = c3.generate({
        bindto: document.getElementById(chartId),
        data: {
            columns: [
                scoresWithLabels
            ]
        },
        title: {
            text: `${chartId.replace('-', ' ')}`
        }
    });
}

function processCourse(activities, course) {
    const resultsWrapper = document.querySelector('#results');
    let courseTotal = 0;
    let courseBest = 999;
    let courseWorst = -999;
    let allCourseRounds = [];
    let totalTime = 0;
    for (const activity of activities) {
        if ('description' in activity) {
            // process rounds played
            roundsObj = parseTupleString(activity.description);
            totalTime += activity.elapsedTime;
            for (round of roundsObj) {
                score = round.reduce((a,b) => b + a);
                allCourseRounds.push(round);
                courseTotal += 1;
                if (score < courseBest) {
                    courseBest = score; 
                }
                if (score > courseWorst) {
                    courseWorst = score;
                }
            }
        }
    }
    let bestHoleAverage = 999;
    let worseHoleAverage = -999;
    let bestHole = 0;
    let worstHole = 0;
    let allHoleScores = [];
    for (let i = 0; i < allCourseRounds[0].length; i++) {
        holeName = i + 1;
        holeScores = allCourseRounds.map(x => x[i]);
        allHoleScores.push(holeScores);
        holeAverage = holeScores.reduce((a,b) => b + a) / holeScores.length;
        if (holeAverage < bestHoleAverage) {
            bestHoleAverage = holeAverage;
            bestHole = holeName;
        } else if (holeAverage > worseHoleAverage) {
            worseHoleAverage = holeAverage
            worstHole = holeName;
        }
        resultsWrapper.innerHTML += `<div id=hole-${holeName}></div>`;
    }
    courseTotals = { 
        'Total Rounds': courseTotal,
        'Avg Time / Round': `${parseInt((totalTime / courseTotal)/60)} minutes`,
        'Course Best': courseBest,
        'Course Worst': courseWorst,
        'Best Hole': `${bestHole} (avg: ${bestHoleAverage})`,
        'Worst Hole': `${worstHole} (avg: ${worseHoleAverage})`
    };
    courseWrapper = document.querySelector(`#${course} .table`);
    courseWrapper.innerHTML += buildTable(courseTotals);
    setTimeout(function () {
        for (let i = 0; i < allHoleScores.length; i++) {
            buildChart(`hole-${i+1}`, allHoleScores[i]);
        }
    }, 500);
}

// takes an object and builds an html table from it
function buildTable(object) {
    let thead = '<table><thead><tr>'
    let tbody = '<tbody><tr>'
    for (const [key, val] of Object.entries(object)) {
        thead += `<th>${key}</th>`;
        tbody += `<td>${val}</td>`;
    }
    const table = `${thead}</tr></thead>${tbody}</tr></tbody></table>`;
    return table;
}

// looks up what we've cached in local storage and analyzes data / creates graphs
function visualizeData() {
    const resultsWrapper = document.querySelector('#results');
    const allActivities = JSON.parse(localStorage.getItem('activity_cache')).reverse();
    allProcessed = processTotals(allActivities);
    resultsWrapper.innerHTML += '<h2>Totals</h2>';
    resultsWrapper.innerHTML += buildTable(allProcessed);
    courseNames = allActivities.map(x => extractCourseName(x.name)).filter(onlyUnique);
    for (course of courseNames) {
        courseRounds = allActivities.filter(x => extractCourseName(x.name) === course);
        resultsWrapper.innerHTML += `<div id="${course}"><h2>${course} Course</h2><div class="table"></div></div>`;
        processCourse(courseRounds, course);
    }
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
                // add an error popup!!!
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
                fetchData().then(() => {visualizeData()});
            });
        } else {
            fetchData().then(() => {visualizeData()});
        }
    }
}