# Telepresence Client

This repository contains the codebase for the telepresence client, which provides a web-based interface communicating with the robot's tablet, ROS system, and local API servers (ASR & VLMaps). The web app uses input from a game controller, point-and-click actions on a 2D map, and two-way audio streams from the teleconferencing feed to control the robot.

## Dependencies

The `scripts` directory contains the last supported versions of all required dependencies. 

Upgrading these libraries to the latest versions may break compatibility, so it is recommended to use the local files provided in the repository instead of relying on a CDN.

## Usage

To serve the app locally, run a simple Python web server with the following command:

```
python3 -m http.server 8080
```

After running this command, the web app will be accessible from the local network at `http://{ip}:8080`. If the web app is accessed from a machine other than the local host, you may need to whitelist the host computer's IP address as a secured origin. For example, in Chrome, this can be done via `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

### Testing

The interface includes a text box for testing the dialogue-based navigation system without requiring the robot or video communication components. Only the VLMaps component is needed to run this test.

1. Ensure that the VLMaps component is running on your local machine.
2. In the `ipApi` input field, set the value to `localhost`.
3. Simulate spoken dialogue by typing it into the `speechText` input in the following format (with "A" being the teleoperator and "B" being the person collocating with the robot):

```
B: Let’s start with the large box on the top shelf.
A: I can reach it. After that, should we look at the smaller boxes on the
floor?
B: Yes, then we can head to the workspace.
```

4. Press `F2` to send the dialogue to the VLMaps server. The text in the `speechText` input will be treated as the current dialogue. Once the goals are derived, the input field will be cleared, and the dialogue will be appended to the dialogue history, providing context for subsequent inputs.