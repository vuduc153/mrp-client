"use strict";

const REMOTE_SPEAKER_VOLUME = 0.5;

const remoteVideo = document.getElementById('remoteVideo');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const ipInputAndroid = document.getElementById('ipAndroid');
const ipInputROS = document.getElementById('ipROS');
const ipInputApi = document.getElementById('ipApi');

let peerConnection = null;
let android = null;
let ros = null;
let asrRemote = null;
let asrLocal = null;

const remoteStream = new MediaStream();

function initConnection() {
    try {
        initAndroidConnection();
        initRosConnection();
        initAsrRemoteConnection();
        initAsrLocalConnection();
    } catch(exception) {
        disconnect();
        logMessage(exception);
    }
}

// ==== Connection to Android =====

function initAndroidConnection() {
    const port = "8080";
    const protocol = "ws://";
    const ip = ipInputAndroid.value;
    const wsUrl = `${protocol}${ip}:${port}`;

    if (ip) {
        android = new WebSocket(wsUrl);

        android.onopen = () => {
            logMessage('Connected to Android server');
            setConnectedState(true);
            makeCall();
        };

        android.onmessage = event => {
            logMessage('Received message: ' + event.data);
            handleRTCMessage(event.data);
        };

        android.onclose = () => {
            logMessage('Disconnected from Android server');
            disconnect();
        };

        android.onerror = error => {
            logMessage('Android error: ');
            logMessage(error);
        };
    }
}

// ==== Connection to ROS =====

function initRosConnection() {
    const port = "9090";
    const protocol = "ws://";
    const ip = ipInputROS.value;
    const wsUrl = `${protocol}${ip}:${port}`;
    
    if (ip) {
        ros = new ROSLIB.Ros({
            url : wsUrl
        });

        ros.on("connection", () => {
            logMessage('Connected to ROS server');
            setConnectedState(true);
            initMap();
            initJoystick();
            showMapBlock();
        });

        ros.on("close", () => {
            logMessage('Disconnected from ROS server');
            disconnect();
        });

        ros.on("error", error => {
            logMessage('ROS error: ');
            logMessage(error);
        });
    }
}

function logMessage(message) {
    console.log(message);
}

function disconnect() {
    closeWebsocket(android);
    closeWebsocket(ros);
    closeWebsocket(asrRemote);
    closeWebsocket(asrLocal);
    closePeerConnection();
    hideMapBlock();
    setConnectedState(false);
}

function closeWebsocket(ws) {
    if (ws) {
        ws.close();
        ws = null;
    }
}

// Connection to ASR server

function initAsrRemoteConnection() {
    const port = "43007";
    const protocol = "ws://";
    const ip = ipInputApi.value;
    const wsUrl = `${protocol}${ip}:${port}`;

    asrRemote = new WebSocket(wsUrl);
    asrRemote.binaryType = 'arraybuffer';

    asrRemote.onopen = () => {
        logMessage('Connected to ASR remote server');
    };

    asrRemote.onmessage = event => {
        updateTranscriptionState(remoteState, event.data);
    };

    asrRemote.onclose = () => {
        logMessage('Disconnected from ASR remote server');
    };

    asrRemote.onerror = error => {
        logMessage('ASR error: ');
        logMessage(error);
    };
}

function initAsrLocalConnection() {
    const port = "43006";
    const protocol = "ws://";
    const ip = ipInputApi.value;
    const wsUrl = `${protocol}${ip}:${port}`;

    asrLocal = new WebSocket(wsUrl);
    asrLocal.binaryType = 'arraybuffer';

    asrLocal.onopen = () => {
        logMessage('Connected to ASR local server');
    };

    asrLocal.onmessage = event => {
        updateTranscriptionState(localState, event.data);
    };

    asrLocal.onclose = () => {
        logMessage('Disconnected from ASR local server');
    };

    asrLocal.onerror = error => {
        logMessage('ASR error: ');
        logMessage(error);
    };
}

function startAudioTranscription(stream, asr) {
    const audioContext = new AudioContext({ latencyHint: 'interactive' });

    audioContext.audioWorklet.addModule('scripts/voice-processor.js')
        .then(function() {
            
            const workletNode = new AudioWorkletNode(audioContext, 'voice-processor');
            workletNode.port.postMessage({ sampleRate: audioContext.sampleRate });

            workletNode.port.onmessage = function(event) {
                const outputData = event.data.buffer;

                if (asr && asr.readyState === WebSocket.OPEN) {
                    asr.send(outputData);
                }
            };

            const mediaStream = audioContext.createMediaStreamSource(stream);
            mediaStream.connect(workletNode);
            workletNode.connect(audioContext.destination);
        })
        .catch(function(err) {
            console.error('Error initializing audio context or processing audio.', err);
        });
}

// ==== WebRTC & media setup for video calling ====

async function makeCall() {
    setupPeerConnection();
    await setupLocalMediaStream();
    setupSDP();
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection({'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]});

    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            android.send(JSON.stringify({'type': 'candidate', 'iceCandidate': event.candidate}));
        }
    });

    peerConnection.addEventListener('connectionstatechange', event => {
        if (peerConnection.connectionState === 'connected') {
            logMessage('Peer connected');
        }
        if (peerConnection.connectionState == 'disconnected') {
            logMessage('Peer closed');
        }
    });

    peerConnection.addEventListener('track', event => {
        remoteStream.addTrack(event.track);
        if(!remoteVideo.srcObject) {
            logMessage('Remote stream added.');
            remoteVideo.srcObject = remoteStream;
            startAudioTranscription(remoteStream, asrRemote);
        }
    });
}

async function setupLocalMediaStream() {
    const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {width: 1280, height: 720}
      });
    
    startAudioTranscription(media, asrLocal);
  
    //   // Lower stream output volume since for some reason this cannot be done from Cruzr's end
    //   // const audioContext = new AudioContext();
    //   // const gainNode = audioContext.createGain();
    //   // const audioSource = audioContext.createMediaStreamSource(media);
    //   // const audioDestination = audioContext.createMediaStreamDestination();
  
    //   // audioSource.connect(gainNode);
    //   // gainNode.connect(audioDestination);
    //   // gainNode.gain.value = 0.5;
  
    peerConnection.addStream(media);
}

async function setupSDP() {
    try {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        android.send(JSON.stringify(offer));
    } catch (exception) {
        logMessage(exception);
    }
}

function handleRTCMessage(message) {
    try {
        const json = JSON.parse(message);
        if (json.type == "candidate" && peerConnection != null) {
            peerConnection.addIceCandidate(json).then(() => {
                logMessage('Added ICE candidate ' + json);
            }).catch((err) => {
                logMessage(err);
            });
        }
        if (json.type == "answer" && peerConnection != null) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(json)).then(() => {
                logMessage('Received SDP answer ' + json.sdp);
            }).catch((err) => {
                logMessage(err);
            });
        }
    } catch(exception) {
        logMessage(exception);
    }
}

function closePeerConnection() {
    if (peerConnection != null) {
        peerConnection.close();
        remoteVideo.srcObject = null;
        peerConnection = null;
    }
}

function setConnectedState(connected) {
    if (!connected) {
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
    } else {
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
    }
}