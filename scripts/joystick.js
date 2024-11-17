// Logitech controller
"use strict";

function initJoystick() {

    let gamepad_idx = -1;

    window.addEventListener("gamepadconnected", function(e) {
        if (gamepad_idx !== -1) return;
        gamepad_idx = e.gamepad.index;

        console.log(`Gamepad connected: ${e.gamepad.id}`);
    });

    window.addEventListener("gamepaddisconnected", function(e) {
        if (e.gamepad.index === gamepad_idx) {
            gamepad_idx = -1;  
        }
        console.log(`Gamepad disconnected: ${e.gamepad.id}`);
    });

    let joyTopic = new ROSLIB.Topic({
        ros: ros,
        name: "joy",
        messageType: "sensor_msgs/Joy",
    });

    function publishGamepadState() {
        if (gamepad_idx === -1) return;

        const gamepad = navigator.getGamepads()[gamepad_idx];

        const currentTime = new Date();
        const secs = Math.floor(currentTime.getTime()/1000);
        const nsecs = Math.round(1000000000*(currentTime.getTime()/1000-secs));

        let message = new ROSLIB.Message({
            header: {
                stamp: {
                    secs: secs,
                    nsecs: nsecs
                },
                frame_id: "web_joystick"
            },
            axes: suppressAxisDrift(remapAxes(gamepad.axes, gamepad.buttons)),
            buttons: remapButtons(gamepad.buttons)
        });
        joyTopic.publish(message);
    }

    function remapAxes(axes, buttons) {
        const pressed = buttons.map((x) => { return x.pressed ? 1 : 0; });
        let newAxes = axes.map((x) => -x);
        newAxes[4] = 0 || pressed[14] || -pressed[15];
        newAxes[5] = 0 || pressed[12] || -pressed[13];
        return newAxes;
    }

    function remapButtons(buttons) {
        const pressed = buttons.map((x) => { return x.pressed ? 1 : 0; });
        let newButtons = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        newButtons[0] = pressed[2];
        newButtons[1] = pressed[0];
        newButtons[2] = pressed[1];
        newButtons[3] = pressed[3];
        newButtons[4] = pressed[4];
        newButtons[5] = pressed[5];
        newButtons[6] = pressed[6];
        newButtons[7] = pressed[7];
        newButtons[8] = pressed[8];
        newButtons[9] = pressed[9];
        newButtons[10] = pressed[10];
        newButtons[11] = pressed[11];
        return newButtons;
    }

    function suppressAxisDrift(axes) {
        return axes.map(item => Math.abs(item) < 0.05 ? 0: item);
    }

    setInterval(publishGamepadState, 100 /* 10 Hz */);
}