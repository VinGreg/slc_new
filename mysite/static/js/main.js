document.addEventListener('DOMContentLoaded', function() {
    console.log('Hello from main.js');

    var inputUsername = document.querySelector('#username');
    var btnJoin = document.querySelector('#btn-join');
    var localVideo = document.querySelector('#local-video');
    var btnToggleAudio = document.querySelector('#btn-toggle-audio');
    var btnToggleVideo = document.querySelector('#btn-toggle-video');
    var btnPredict = document.getElementById('btn-predict');
    var outputText = document.getElementById('output-text');
    var guideBox = document.getElementById('guide-box');
    var recordButton = document.getElementById('btn-record');
    var btnShareScreen = document.getElementById('btn-share-screen');
    var sharePrediction = document.getElementById('share-prediction');
    var sharePredictionBtn= document.getElementById('popup-share-prediction');
    var chat= document.getElementById('chat');
    var msgBtn= document.getElementById('msg-button');
    
    var mapPeers = {};
    var username;
    var webSocket;
    var meetingId;

    if (typeof google !== 'undefined' && google.accounts) {
        gisLoaded();
    } else {
        console.error("Google Identity Services SDK not loaded.");
    }
    
    
    // Button listeners
    document.getElementById('loginBtn')?.addEventListener('click', signIn);
    document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', signIn);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }

    gisLoaded();


    function generateMeetingId() {
        return 'meeting-' + Math.random().toString(36).substr(2, 9);
    }
    
    //JOIN MEETING
    if (btnJoin){
        btnJoin.addEventListener('click', function() {
            
            username = inputUsername.value;
            console.log('Username:', username);

            if (username == '') {
                return;
            }

            inputUsername.value = '';
            inputUsername.disabled = true;
            inputUsername.style.visibility = 'hidden';
            document.querySelector('#username-label').style.visibility = 'hidden';
            document.querySelector('#username-display').classList.remove('hidden');
            document.querySelector('#displayed-username').textContent = username;

            btnJoin.disabled = true;
            btnJoin.style.visibility = 'hidden';

            var loc = window.location;
            var wsStart = 'ws://';

            if (loc.protocol == 'https:') {
                wsStart = 'wss://';
            }

            let meetingId = window.location.pathname.split('/').filter(Boolean).slice(-1)[0];

    // Pastikan meetingId valid
    if (!meetingId || meetingId === '') {
        console.error('Meeting ID tidak valid!');
        return;
    }

    const endpoint = `${wsStart}${loc.host}/ws/meeting/${meetingId}/`;
    console.log('Connecting to:', endpoint);

    webSocket = new WebSocket(endpoint);

            webSocket.addEventListener('open', function(e) {
                console.log('Connection opened:', e);
                sendSignal('new-peer', {});
            });

            webSocket.addEventListener('message', webSocketOnMessage);
            webSocket.addEventListener('close', function(e) {
                console.log('Connection Closed!:', e);
            });
            webSocket.addEventListener('error', function(e) {
                console.log('Connection Error!:', e);
            });
        });
    }

    var screenShareStream; // Track the screen share stream
    var isScreenSharing; // Track if screen sharing is active
    async function startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenShareStream = screenStream;
            isScreenSharing = true;
    
            // Tambahkan track screen sharing ke setiap peer connection
            for (const peerUsername in mapPeers) {
                let peerConnection = mapPeers[peerUsername][0];
    
                screenStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, screenStream);
                });
            }
    
            // Kirim notifikasi ke semua user bahwa layar sedang dibagikan
            webSocket.send(JSON.stringify({
                action: "screen-share",
                peer: username,
            }));
    
        } catch (err) {
            console.error("Gagal berbagi layar:", err);
        }
    }
    

    // WEBRTC Function
    function webSocketOnMessage(event) {
        var parsedData = JSON.parse(event.data);
        var peerUsername = parsedData['peer'];
        var action = parsedData['action'];
    
        if (username == peerUsername) {
            return;
        }
    
        var receiver_channel_name = parsedData['message']['receiver_channel_name'];
    
        if (action == 'new-peer') {
            createOfferer(peerUsername, receiver_channel_name);
            return;
        }
    
        if (action == 'new-offer') {
            var offer = parsedData['message']['sdp'];
            createAnswerer(offer, peerUsername, receiver_channel_name);
            return;
        }
    
        if (action == 'new-answer') {
            var answer = parsedData['message']['sdp'];
            var peer = mapPeers[peerUsername][0];
            peer.setRemoteDescription(answer);
            return;
        }

        if (action === 'prediction') {
            updateParticipantPrediction(peerUsername, parsedData['message']['prediction']);
        }

        if (action === 'stop-prediction') {
            console.log('Stop prediction');
            let predictionItem = document.getElementById(`participant-${peerUsername}`);
            if (predictionItem) {
                predictionItem.remove();
            }
        }
            
        if (action == 'screen-share') {
            let peer = mapPeers[peerUsername][0];
            let remoteScreenStream = new MediaStream();

            // Find the screen track sent by the peer
            peer.getReceivers().forEach(receiver => {
                if (receiver.track.kind === 'video') {
                    remoteScreenStream.addTrack(receiver.track);
                }
            });

            // Create or update the screen video element
            let screenVideo = document.getElementById('screen-video');
            if (!screenVideo) {
                screenVideo = document.createElement('video');
                screenVideo.id = 'screen-video';
                screenVideo.autoplay = true;
                screenVideo.playsInline = true;
                screenVideo.classList.add('w-full', 'h-full', 'object-cover');
                document.getElementById('video-container').appendChild(screenVideo);
            }
            screenVideo.srcObject = remoteScreenStream;

            // Hide the local video and show the screen video
            document.getElementById('local-video-wrapper').style.display = 'none';
            screenVideo.style.display = 'block';
        }

        if (action == 'stop-screen-share') {
            let screenVideo = document.getElementById('screen-video');
            if (screenVideo) {
                screenVideo.remove();
            }

            // Show the local video again
            document.getElementById('local-video-wrapper').style.display = 'block';
        }
    }


    
    // Media Devices
    if (localVideo) {
        var localStream = new MediaStream();
        const constraints = {
            video: true,
            audio: true
        };

        var userMedia = navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = localStream;
                localVideo.muted = true;

                var audioTracks = stream.getAudioTracks();
                var videoTracks = stream.getVideoTracks();

                audioTracks[0].enabled = true;
                videoTracks[0].enabled = true;

                if (btnToggleAudio) {
                    btnToggleAudio.addEventListener('click', function() {
                        audioTracks[0].enabled = !audioTracks[0].enabled;
                        btnToggleAudio.innerHTML= `<i id="icon-audio" class="fas fa-microphone-slash text-red-400 text-sm"></i>`;
                        
                        if (audioTracks[0].enabled) {
                            btnToggleAudio.innerHTML= `<i id="icon-audio" class="fas fa-microphone text-yellow-400 text-sm"></i>`;
                            return;
                        }
                    });
                }

                if (btnToggleVideo) {
                    btnToggleVideo.addEventListener('click', function() {
                        const videoTracks = localStream.getVideoTracks();
                        videoTracks[0].enabled = !videoTracks[0].enabled;
                        btnToggleVideo.innerHTML = videoTracks[0].enabled ?
                            `<i id="icon-video" class="fas fa-video text-green-400 text-sm"></i>` :
                            `<i id="icon-video" class="fas fa-video-slash text-red-400 text-sm"></i>`;
                    });
                }
            })
            .catch(error => {
                console.error('Error accessing media devices.', error);
            });
    }


    // Chat
    var btnSendMsg= document.getElementById('btn-send-msg');
    var msgList= document.getElementById('message-list');
    var msgInput= document.getElementById('msg');

    if (btnSendMsg) {
        btnSendMsg.addEventListener('click', sendMsgOnClick);
    }
    
    function sendMsgOnClick() {
        var message= msgInput.value;
        var li= document.createElement('li');

        li.appendChild(document.createTextNode('Me: '+ message));
        msgList.appendChild(li);

        var dataChannels= getDataChannels();

        message= username+ ': '+ message;

        for(index in dataChannels) {
            dataChannels[index].send(message);
        }

        msgInput.value= '';
    }

    function sendSignal(action, message) {
        var jsonStr = JSON.stringify({
            'peer': username,
            'action': action,
            'message': message,
        });

        webSocket.send(jsonStr);
    }

    // Offer
    function createOfferer(peerUsername, receiver_channel_name) {
        var peer = new RTCPeerConnection(null);
        addLocalTracks(peer);
    
        var dc = peer.createDataChannel('channel');
        dc.addEventListener('open', function() {
            console.log('Connection opened!');
        });
        dc.addEventListener('message', dcOnMessage);
    
        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);
    
        mapPeers[peerUsername] = [peer, dc];
    
        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;
    
            if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];
                if (iceConnectionState !== 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo, peerUsername);
            }
        });
    
        peer.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                return;
            }
    
            sendSignal('new-offer', {
                'sdp': peer.localDescription,
                'receiver_channel_name': receiver_channel_name
            });
        });
    
        peer.createOffer()
            .then(o => peer.setLocalDescription(o))
            .then(() => {
                console.log('Local Description set successfully!');
            });
    
        // Tambahkan track screen sharing jika sedang aktif
        if (isScreenSharing && screenShareStream) {
            screenShareStream.getTracks().forEach(track => {
                peer.addTrack(track, screenShareStream);
            });
        }
    }
    
    function createAnswerer(offer, peerUsername, receiver_channel_name) {
        var peer = new RTCPeerConnection(null);
        addLocalTracks(peer);
    
        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);
    
        peer.addEventListener('datachannel', (e) => {
            peer.dc = e.channel;
            peer.dc.addEventListener('open', () => {
                console.log('Connection opened!');
            });
            peer.dc.addEventListener('message', dcOnMessage);
    
            mapPeers[peerUsername] = [peer, peer.dc];
        });
    
        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;
    
            if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];
                if (iceConnectionState !== 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo, peerUsername);
            }
        });
    
        peer.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                return;
            }
    
            sendSignal('new-answer', {
                'sdp': peer.localDescription,
                'receiver_channel_name': receiver_channel_name
            });
        });
    
        peer.setRemoteDescription(offer)
            .then(() => {
                console.log('Remote Description set successfully for %s.', peerUsername);
                return peer.createAnswer();
            })
            .then(a => {
                console.log('Answer created!');
                peer.setLocalDescription(a);
            });
    
        // Tambahkan track screen sharing jika sedang aktif
        if (isScreenSharing && screenShareStream) {
            screenShareStream.getTracks().forEach(track => {
                peer.addTrack(track, screenShareStream);
            });
        }
    }

    function addLocalTracks(peer) {
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });
        return;
    }

    var messageList = document.querySelector('#message-list');
    function dcOnMessage(event) {
        var message = event.data;

        var li = document.createElement('li');
        li.appendChild(document.createTextNode(message));
        messageList.appendChild(li);
    }

    function updateVideoLayout() {
        const videoContainer = document.getElementById('video-container');
        const remoteVideos = document.getElementById('remote-videos');
        const numVideos = remoteVideos.children.length + 1; // Including local video

        if (numVideos === 1) {
            videoContainer.style.gridTemplateColumns = '1fr';
            videoContainer.style.gridTemplateRows = '1fr';
            document.getElementById('local-video-wrapper').classList.add('fullscreen');
        } else {
            document.getElementById('local-video-wrapper').classList.remove('fullscreen');
            if (numVideos === 2) {
                videoContainer.style.gridTemplateColumns = '1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr';
            } else if (numVideos <= 4) {
                videoContainer.style.gridTemplateColumns = '1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr 1fr';
            } else {
                videoContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr 1fr';
            }
        }
    }

    function createVideo(peerUsername) {
        let videoContainer = document.getElementById('remote-videos');

        let videoWrapper = document.createElement('div');
        videoWrapper.id = `video-wrapper-${peerUsername}`;
        videoWrapper.classList.add('video-wrapper');
        
        // Check if participant name already exists in video wrapper
        let usernameLabel = videoWrapper.querySelector('.participant-username');
        if (!usernameLabel) {
            // If not, create name element
            usernameLabel = document.createElement('div');
            usernameLabel.classList.add('participant-username');
            usernameLabel.textContent = peerUsername;
        }

        // Create video element
        let videoElement = document.createElement('video');
        videoElement.id = `video-${peerUsername}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.classList.add('remote-video');

        // Add username and video to video wrapper
        videoWrapper.appendChild(usernameLabel);
        videoWrapper.appendChild(videoElement);
        
        // Add video wrapper to container
        videoContainer.appendChild(videoWrapper);

        // Update layout and display
        addParticipantName(peerUsername);
        updateVideoLayout(); // Update layout every time a new video is added

        return videoElement;
    }

    function setOnTrack(peer, remoteVideo) {
        let remoteStream = new MediaStream();

        peer.addEventListener('track', async (event) => {
            remoteStream.addTrack(event.track);
            remoteVideo.srcObject = remoteStream;
        });
    }

    function removeVideo(video, peerUsername) {
        var videoWrapper = video.parentNode;
        videoWrapper.parentNode.removeChild(videoWrapper);

        // Remove participant name from the participants list
        removeParticipantName(peerUsername);

        updateVideoLayout(); // Update layout whenever a video is removed
    }

    function getDataChannels() {
        var dataChannels = [];
    
        for(peerUsername in mapPeers) {
            var dataChannel= mapPeers[peerUsername][1];
    
            dataChannels.push(dataChannel);
        }
    
        return dataChannels;
    }

    function addParticipantName(peerUsername) {
        const participantsList = document.getElementById('participants-list');
        
        // Check if element already exists based on participant ID
        if (!document.getElementById(`participant-${peerUsername}`)) {
            const participantItem = document.createElement('div');
            participantItem.id = `participant-${peerUsername}`;
            participantItem.classList.add('text-white');
            participantItem.textContent = peerUsername;
            participantsList.appendChild(participantItem);
        }
    }

    function removeParticipantName(peerUsername) {
        const participantItem = document.getElementById(`participant-${peerUsername}`);
        if (participantItem) {
            participantItem.parentNode.removeChild(participantItem);
        }
    }



    // SHARE SCREEN
    if (btnShareScreen) {
        btnShareScreen.addEventListener('click', async function() {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                handleScreenShare(screenStream);
            } catch (error) {
                console.error("Gagal mendapatkan akses berbagi layar:", error);
                alert("Gagal berbagi layar. Pastikan Anda memberi izin akses.");
            }
        });
    }

    function sendScreenShareSignal(screenStream) {
        for (let peerUsername in mapPeers) {
            let peer = mapPeers[peerUsername][0];
            let sender = peer.getSenders().find(s => s.track.kind === 'video');
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
    
            // Kirim sinyal berbagi layar ke semua pengguna
            sendSignal('screen-share', { 'peer': username });
        }
    }

    async function handleScreenShare(screenStream) {
        // Simpan status awal kamera
        const videoTracks = localStream.getVideoTracks();
        const initialVideoEnabled = videoTracks[0].enabled;
    
        // Kirim stream berbagi layar ke semua pengguna yang terhubung
        sendScreenShareSignal(screenStream);
    
        // Tampilkan stream berbagi layar di video lokal
        localVideo.srcObject = screenStream;
    
        // Hentikan berbagi layar saat pengguna berhenti berbagi
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log("Berbagi layar dihentikan, mengembalikan video lokal...");

            // Kembalikan stream video asli
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    localStream = stream;
                    localVideo.srcObject = localStream;
                    for (let peerUsername in mapPeers) {
                        let peer = mapPeers[peerUsername][0];
                        let sender = peer.getSenders().find(s => s.track.kind === 'video');
                        sender.replaceTrack(localStream.getVideoTracks()[0]);
                    }

                    // Kembalikan status awal kamera
                    localStream.getVideoTracks()[0].enabled = initialVideoEnabled;

                    // Pastikan elemen video lokal kembali menjadi utama
                    document.getElementById('local-video-wrapper').style.display = 'block';
                    const screenVideo = document.getElementById('screen-video');
                    if (screenVideo) {
                        screenVideo.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error("Gagal mengembalikan stream video asli:", error);
                });
        });
    }

    // RECORDING MEETING
    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    if (recordButton) {
        recordButton.addEventListener('click', async function() {
            console.log("Tombol record diklik");

            if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log("Menghentikan rekaman...");
                await stopRecordingAndSave(); // Pastikan rekaman dihentikan dengan benar sebelum reset tombol
                recordButton.innerHTML = '<i class="fas fa-record-vinyl text-red-400 text-sm"></i>';
            } else {
                console.log("Memulai rekaman...");
                await startRecording();
                recordButton.innerHTML = '<i class="fas fa-stop text-red-400 text-sm"></i>';
            }
        });

        async function startRecording() {
            try {
                console.log("Meminta akses rekaman layar...");
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                console.log("Akses diberikan, mulai merekam...");

                // Meminta akses ke mikrofon
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log("Akses mikrofon diberikan...");

                // Gabungkan stream layar dan audio
                const combinedStream = new MediaStream([
                    ...displayStream.getVideoTracks(),
                    ...audioStream.getAudioTracks()
                ]);

                const audioTracks = combinedStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log("Audio track ditemukan:", audioTracks[0]);
                } else {
                    console.warn("Tidak ada audio track yang ditemukan!");
                }

                let options = { mimeType: 'video/webm; codecs=vp9' };
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(combinedStream, options);

                mediaRecorder.ondataavailable = function(event) {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                        console.log("Data rekaman tersedia, ukuran chunk:", event.data.size);
                        console.log("Total recordedChunks saat ini:", recordedChunks.length);
                    }
                };

                mediaRecorder.onstop = function () {
                    console.log("Rekaman berhenti.");
                    if (recordedChunks.length > 0) {
                        let blob = new Blob(recordedChunks, { type: "video/webm" });
                        console.log("Ukuran akhir rekaman (Blob):", blob.size, "bytes");
    
                        saveToLocal(blob, meetingId);
                    } else {
                        console.warn("Tidak ada data rekaman yang tersimpan!");
                    }
                    recordedChunks = []; // Reset setelah disimpan
                };

                mediaRecorder.start();
                console.log("MediaRecorder dimulai.");
            } catch (error) {
                console.error("Gagal mendapatkan akses media:", error);
                alert("Gagal merekam layar. Pastikan Anda memberi izin akses.");
            }
        }


        function saveToLocal(blob, meetingId) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Meeting Recorded ${meetingId}.webm`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        }  
    }
    
            


    // Saat end-meet, pastikan rekaman tersimpan dulu
    const endMeetButton = document.getElementById("end-meet-btn");
    const endMeetForm = document.getElementById("end-meet-form");

    if (endMeetForm && endMeetButton) {
        endMeetButton.addEventListener("click", async function (event) {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                console.log("End Meeting ditekan saat rekaman berlangsung. Menghentikan dan menyimpan rekaman...");
                event.preventDefault(); // Cegah form langsung terkirim
                await stopRecordingAndSave(); // Tunggu hingga rekaman benar-benar tersimpan
            } else {
                console.log("Tidak ada rekaman yang sedang berjalan, langsung mengakhiri meeting.");
            }
    
            console.log("Mengirim form untuk mengakhiri meeting...");
            setTimeout(() => {
                endMeetForm.submit();
            }, 3000);
        });
    }
    

    async function stopRecordingAndSave() {
        if (!mediaRecorder || mediaRecorder.state !== "recording") {
            console.warn("Tidak ada rekaman yang sedang berjalan atau mediaRecorder tidak terinisialisasi.");
            return;
        }
    
        return new Promise((resolve) => {
            console.log("Menghentikan rekaman...");
    
            mediaRecorder.addEventListener("stop", function () {
                console.log("Rekaman dihentikan, menyimpan file...");
    
                if (recordedChunks.length > 0) {
                    let blob = new Blob(recordedChunks, { type: "video/webm" });
                    saveToLocal(blob, meetingId);
                } else {
                    console.warn("Tidak ada data rekaman yang tersimpan!");
                }
    
                recordedChunks = []; // RESET DATA SETELAH DISIMPAN
                setTimeout(resolve, 3000);
            }, { once: true });
                mediaRecorder.stop();
            
        });
    }
    
    // Sign Language Prediction
    if (btnPredict && outputText && guideBox) {
        let model;
        let isPredicting = false;
        let predictionTimeout;
        let predictedWords = [];
        let currentPrediction = "";
        let lastPrediction = "";
        let lastPredictionTime = 0;
        let deleting = false; // Status penghapusan

        const classLabels = [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 
            'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            'SPACE', 'NOTHING', 'DELETE'
        ];

        btnPredict = document.getElementById('btn-predict');
        outputText= document.getElementById('output-text');
        guideBox= document.getElementById('guide-box');

        // Load the model
        async function loadModel() {
            try {
                model = await tf.loadLayersModel("/./static/model/model.json"); // Path to your TensorFlow.js model
                console.log("Model loaded successfully!");
            } catch (error) {
                console.error("Error loading model:", error);
            }
        }

        // Preprocess video frame for prediction
        function preprocessFrame(videoElement) {
            const canvas = document.createElement('canvas');
            canvas.width = 224; // Match model input size
            canvas.height = 224;
            const ctx = canvas.getContext('2d');
            const boxRect = guideBox.getBoundingClientRect();
            const videoRect = localVideo.getBoundingClientRect();
            // Hitung rasio perbedaan antara ukuran tampilan video dan ukuran asli
            const scaleX = videoElement.videoWidth / videoRect.width;
            const scaleY = videoElement.videoHeight / videoRect.height;
            // Hitung koordinat dalam skala video asli
            const x = (boxRect.left - videoRect.left) * scaleX;
            const y = (boxRect.top - videoRect.top) * scaleY;
            const width = boxRect.width * scaleX;
            const height = boxRect.height * scaleY;
            ctx.drawImage(videoElement, x, y, width, height, 0, 0, canvas.width, canvas.height);
            let imageData = tf.browser.fromPixels(canvas);
            imageData = imageData.expandDims(0); // Add batch dimension
            imageData = imageData.toFloat().div(127.5).sub(1); // Normalize to [-1, 1] (for MobileNetV2)
            return imageData;
        }

        // Make predictions
        async function predictSignLanguage() {
            try {
                if (model && localVideo.readyState >= 2) {
                    tf.engine().startScope();

                    const inputTensor = preprocessFrame(localVideo);
                    const prediction = await model.predict(inputTensor);
                    const classIndex = prediction.argMax(1).dataSync()[0];
                    const predictedLabel = classLabels[classIndex];
                    const now = Date.now();

                    if (predictedLabel === "DELETE") {
                        if (!deleting && predictedWords.length > 0) {
                            deleting = true; // Mulai proses penghapusan
                            let tempWord = predictedWords.slice(0, -1);
                            let deletingChar = predictedWords[predictedWords.length - 1];
    
                            // Tampilkan huruf yang akan dihapus dalam warna merah
                            outputText.innerHTML = `Word: ${tempWord}<span style="color: red;">${deletingChar}</span>`;
    
                            setTimeout(() => {
                                // Jika pengguna tetap dalam mode DELETE selama 2 detik, hapus huruf
                                if (deleting) {
                                    predictedWords = tempWord;
                                    outputText.innerHTML = `Word: ${predictedWords.join("")}`;
                                    deleting = false;
                                }
                            }, 2000);
                        }
                        return;
                    } else if (predictedLabel === "SPACE") {
                        if (predictedWords.length > 0 && predictedWords[predictedWords.length - 1] !== " " && now - lastPredictionTime >= 2000) {
                            predictedWords.pop();
                            predictedWords.push(" ");
                            lastPrediction = "";
                            currentPrediction = "";
                        }
                    } else if (predictedLabel !== "NOTHING") {
                        if (predictedLabel === lastPrediction) {
                            // Jika prediksi tetap sama selama 3 detik, tambahkan ke array
                            if (now - lastPredictionTime >= 3000) {
                                predictedWords.push(predictedLabel);
                                lastPrediction = ""; // Reset agar tidak terus menambahkan
                                currentPrediction = "";
                            }
                        } else {
                            // Jika prediksi berubah, restart timer
                            lastPrediction = predictedLabel;
                            lastPredictionTime = now;
                        }
                        currentPrediction = predictedLabel;
                    } else {
                        currentPrediction = "";
                    }

                    // Update display to show the current letter being recognized
                    let displayText = predictedWords.join("");

                    outputText.innerHTML = `Word: ${displayText}<span style="color: gold;">${currentPrediction}</span>`;

                    sendSignal("prediction", { prediction: displayText });
                    tf.dispose(inputTensor); // Dispose tensors to free memory
                    tf.dispose(prediction);
                }
            } catch (error) {
                console.error("Error during prediction:", error);
            }
        }

        // Function to toggle prediction on/off
        async function togglePrediction() {
            // Function to toggle prediction on/off
            if (!isPredicting) {
                // Mulai prediksi
                await loadModel();
                isPredicting = true;
                console.log("Prediction started...");
                btnPredict.innerHTML = '<i class="fas fa-hand text-white text-sm"></i>';
                guideBox.style.visibility = 'visible';
                const predictLoop = async () => {
                    if (!isPredicting) return; // Stop if prediction is turned
                    await predictSignLanguage(); // Wait until prediction is finished
                    predictionTimeout= setTimeout(predictLoop, 200); // Call predict again after 200ms
                };
                predictLoop();
            } else {
                sendSignal("stop-prediction", {});
                // Hentikan prediksi
                isPredicting = false;
                outputText.innerText = "";
                btnPredict.innerHTML = '<i class="fas fa-hand text-grey text-sm"></i>';
                guideBox.style.visibility = 'hidden';
                console.log("Prediction stopped.");
                predictedWords= [];
                lastPrediction= "";
                clearTimeout(predictionTimeout);
                // Hapus model dari memori dengan aman
                if (model) {
                    model.dispose();
                    model = null;
                }

                // Hapus semua tensor aktif
                tf.engine().endScope();
            }
        }

        btnPredict.addEventListener('click', togglePrediction);
    }

    function updateParticipantPrediction(peerUsername, prediction) {
        let predictionItem = document.getElementById(`prediction-${peerUsername}`);
        if (!predictionItem) {
            predictionItem = document.createElement('div');
            predictionItem.id = `prediction-${peerUsername}`;
            predictionItem.classList.add('prediction-item');
            predictionItem.classList.add('text-2xl', 'text-white', 'font-bold');
            sharePrediction.appendChild(predictionItem);
        }
        predictionItem.textContent = `${peerUsername}: ${prediction}`;
    }

    if (sharePredictionBtn && sharePrediction) {
        sharePredictionBtn.addEventListener('click', function () {
            if (sharePrediction.style.display === 'none') {
                sharePrediction.style.display = 'block';
            } else {
                sharePrediction.style.display = 'none';
            }
        });
    } 

    const navMenu = document.getElementById('nav-menu');
    const navbarDropdown = document.getElementById('navbar-dropdown');

    if (navMenu && navbarDropdown) {
        navMenu.addEventListener('click', function () {
            if (navbarDropdown.style.display === 'none') {
                navbarDropdown.style.display = 'block';
            } else {
                navbarDropdown.style.display = 'none';
            }
        });
    }
    

    // if (window.location.pathname.includes('login')) {
    //     gisLoaded();

    // }
    
});

// Google API
const CLIENT_ID = '466179634693-s2gsnc5bg75iglmhrq5ajuuphufnl6a6.apps.googleusercontent.com';
const SCOPES = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

let tokenClient;
let gisInited = false;

function gisLoaded() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error("Google Identity Services SDK not loaded.");
        const statusEl = document.getElementById("googleStatus");
        if (statusEl) statusEl.innerText = "Failed to load Google Sign-In.";
        return;
    }
    console.log("Google Identity Services loaded.");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleAuthResponse,
    });
    gisInited = true;

    // Aktifkan tombol login
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const statusEl = document.getElementById("googleStatus");
    if (loginBtn) {
        loginBtn.disabled = false;
        console.log("Login button enabled.");
    }

    if (statusEl) {
        statusEl.innerText = "Google Sign-In is ready!";
        console.log("Google Sign-In status updated.");
    }

    if (logoutBtn) {
        console.log("Logout button found in DOM.");
    }

    if (statusEl) {
        statusEl.innerText = "Google Sign-In is ready!";
        console.log("Google Sign-In status updated.");
    }
    checkLoginStatus();
}

// Cek status login dari localStorage
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    

    if (accessToken) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        
    }

    if (logoutBtn) {
        console.log("Logout button found in DOM.");
        console.log("Logout button visibility:", window.getComputedStyle(logoutBtn).display);
        logoutBtn.style.display = 'block'; // Paksa tombol Logout terlihat untuk debugging
        console.log("Logout button updated display:", window.getComputedStyle(logoutBtn).display);
    } 
}

window.signIn = function () {
    console.log("Google Sign-In button clicked.");
    if (!gisInited) {
        console.error("Google Sign-In is not ready yet.");
        alert("Google Sign in is loading. Please try again later.");
        return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function signOut() {
    const token = localStorage.getItem('access_token');
    fetch('/logout/', { method: 'POST', credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            if (data.method === "google" && token) {
                google.accounts.oauth2.revoke(token, () => {
                    console.log('Google Access Token Revoked.');
                });
                localStorage.removeItem('access_token');
                google.accounts.id.disableAutoSelect();
            }
            window.location.href = "/login";
        })
        .catch(error => console.error('Logout failed:', error));
}

function logoutUser() {
    fetch("/logout", {
        method: "POST",
        credentials: "include",
        headers: {
            "X-CSRFToken": getCSRFToken(),
            "Content-Type": "application/json",
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Logout response:", data);
        if (data.status === "success") {
            localStorage.removeItem('access_token');
            window.location.href = "/login";
        } else {
            console.error("Logout failed:", data.message);
        }
    })
    .catch(error => console.error("Logout failed:", error));
}

function handleAuthResponse(response) {
    if (response && response.access_token) {
        console.log('Access Token:', response.access_token);
        localStorage.setItem('access_token', response.access_token);

        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${response.access_token}` },
        })
        .then(res => res.json())
        .then(userInfo => {
            console.log("Google User:", userInfo);

            // Kirim ke backend Django
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
                window.location.href = "/dashboard/";
            })
            .catch(error => console.error("Google login callback failed:", error));
        })
        .catch(error => console.error("Fetching Google user info failed:", error));
    } else {
        console.error('Login failed');
    }
}

function getCSRFToken() {
    return document.cookie.split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
}