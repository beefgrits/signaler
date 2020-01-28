# signaler
Signaling server for WebRTC with Google authentication

Signaler is a node application that can be installed by copying index.js and package.json to your desired directory, updating index.js to set your desired websocket port and the array of authorized users' Google profile IDs, and then calling 'npm install' to install dependencies. 'node index.js' can be run to start the server before configuring and launching the AVstuff.js script from the videoChat client application.
