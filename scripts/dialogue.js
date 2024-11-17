"use strict";

const DEBOUNCE_INTERVAL = 5000;
const terminatingCharacters = new Set(['?', '.', '!']);

const goalsList = document.getElementById('goalsList');
const goalSkeleton = document.getElementById('goalSkeleton');

// testing for vlmaps
const speechText = document.getElementById('speechText');

speechText.addEventListener('keydown', function (event) {
    if (event.key === 'F2') {
        event.preventDefault();
        currentCoordinate = [10.621, 0.055, 0, 0, 0, -0.5085501, 0.8610324]; // dummy value
        currentDialogue += speechText.value;
        currentDialogue += '\n';
        speechText.value = '';
        sendDialogueText();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key == 'F1') {
        event.preventDefault();
        handlePendingBuffers();
        sendDialogueText();
    }
});

let debounceTimer = null;

let localState = {
    label: "A",
    buffer: "",
};

let remoteState = {
    label: "B",
    buffer: "",
};

let dialogueHistory = "";
let currentDialogue = "";

let timerInterval = null;

// for debugging purpose
function startCountdown() {
  let timeLeft = DEBOUNCE_INTERVAL / 1000; 
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(() => {
    console.log(timeLeft);
    timeLeft -= 1;
    if (timeLeft < 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

function debounce() {
    console.log('debounce');
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        startCountdown();
    }
    debounceTimer = setTimeout(() => {
        console.log('parse');
        handlePendingBuffers();
        sendDialogueText();
    }, DEBOUNCE_INTERVAL);
}

function updateTranscriptionState(state, payload) {
    const obj = JSON.parse(payload);

    if (obj.transcript) {
        
        state.buffer += obj.transcript;

        if (terminatingCharacters.has(state.buffer.trim().at(-1))) {
            currentDialogue += `${state.label}: ${state.buffer}\n`;
            state.buffer = '';
        }

        debounce();
    }
}

function handlePendingBuffers() {
    handlePendingBuffer(remoteState);
    handlePendingBuffer(localState);
}

function handlePendingBuffer(state) {
    if (state.buffer) {
        currentDialogue += `${state.label}: ${state.buffer}\n`;
        state.buffer = '';
    }
}

function sendDialogueText() {

    toggleGoalLoading(true);

    const message = {
        'pose': currentCoordinate,
        'past': dialogueHistory,
        'current': currentDialogue
    }

    dialogueHistory += currentDialogue;
    currentDialogue = '';

    const port = "43001";
    const protocol = "http://";
    const ip = ipInputApi.value;
    const server = `${protocol}${ip}:${port}`;
    const endpoint = server + '/parse';

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {

            // Only perform navigation if the intended actor of the movement is the robot aka `A``
            const goals = data.movements.filter(item => item.actor == 'A');

            goals.reverse().forEach(goal => {

                const goalId = generateUniqueId();
                const goalItem = document.createElement('div');

                goalItem.id = goalId;
                goalItem.className = 'flex items-center justify-between px-2 py-2 rounded shadow my-2';
                goalItem.innerHTML = `
                <span class="bg-green-100 text-green-800 text-sm font-medium me-2 px-2.5 py-0.5 dark:bg-green-900 dark:text-green-300 rounded">${goal.target.label}</span>
                <div class="flex space-x-2">
                    <button id="confirmBtn${goalId}" class="bg-gradient-to-r from-cyan-500 to-blue-500 hover:bg-gradient-to-bl text-center inline-flex items-center text-white transition rounded text-sm p-2" onclick="showToast('toast-success')"><i class="fa-solid fa-check"></i></button>
                    <button id="deleteBtn${goalId}" class="bg-gradient-to-br from-pink-500 to-orange-400 hover:bg-gradient-to-bl text-center inline-flex items-center text-white transition rounded text-xs py-2 px-2.5" onclick="showToast('toast-danger')"><i class="fa-solid fa-x"></i></button>
                </div>
                `;

                goalsList.prepend(goalItem);

                const confirmBtn = document.getElementById(`confirmBtn${goalId}`);
                confirmBtn.onclick = () => {
                    let [x, y, z, qx, qy, qz, qw] = goal.target.coordinate;

                    let position = new ROSLIB.Vector3({
                        x: x,
                        y: y
                    });

                    let orientation = new ROSLIB.Quaternion({
                        x: 0,
                        y: 0,
                        z: qz,
                        w: qw
                    });

                    let pose = new ROSLIB.Pose({
                        position: position,
                        orientation: orientation
                    });

                    navClient.navigator.sendGoal(pose);
                    goalItem.remove();
                    showToast('toast-success');
                };

                const deleteBtn = document.getElementById(`deleteBtn${goalId}`);
                deleteBtn.onclick = () => {
                    goalItem.remove();
                    showToast('toast-delete');
                };
            });
            
            toggleGoalLoading(false);
        })
        .catch(error => {
            toggleGoalLoading(false);
            console.error('Error:', error);
        });
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash;
}

function generateUniqueId() {
    const uniqueString = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return 'goal-' + hashCode(uniqueString).toString(36);
}

function toggleGoalLoading(state) {
    if (state) {
        goalsList.classList.add('hidden');
        goalSkeleton.classList.remove('hidden');
    } else {
        goalsList.classList.remove('hidden');
        goalSkeleton.classList.add('hidden');
    }
}