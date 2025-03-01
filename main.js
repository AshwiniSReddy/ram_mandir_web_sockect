

const http = require("http");
const express = require("express");
const app = express();

app.use(express.static("public"));

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");
const osc = require("node-osc");

// Create an OSC client to send messages to TouchDesigner.
const oscIP = "192.168.0.140";
const oscPort = 7000;
const oscClient = new osc.Client(oscIP, oscPort);
console.log("OSC client created:", oscClient);

// Create an OSC server to receive messages from TouchDesigner.
const oscServerPort = 8001;
const oscServer = new osc.Server(oscServerPort, "0.0.0.0", () => {
  console.log(`OSC Server listening on port ${oscServerPort}`);
});

oscServer.on("message", function (msg, rinfo) {
  console.log("Received OSC message:", msg);
  // Example: TouchDesigner sends ["/temple/imageDisplayed", code]
  if (msg[0] === "/temple/imageDisplayed") {
    let code = msg[1];
    console.log(`Image displayed with code ${code}`);
    const response = JSON.stringify({ action: "imageDisplayed", code: code });
    broadcast(null, response, true);
  }
});

let keepAliveId;
const wss =
  process.env.NODE_ENV === "production"
    ? new WebSocket.Server({ server })
    : new WebSocket.Server({ port: 5001 });

server.listen(serverPort);
console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`);

wss.on("connection", function (ws, req) {
  console.log("Connection Opened");
  console.log("Connected Clients:", wss.clients.size);

  if (wss.clients.size === 1) {
    console.log("First connection. Starting keepalive");
    keepServerAlive();
  }

  ws.on("message", (data) => {
    let stringifiedData = data.toString();
    if (stringifiedData === "pong") {
      console.log("Received pong");
      return;
    }

    let messageObj;
    try {
      messageObj = JSON.parse(stringifiedData);
    } catch (error) {
      console.error("Invalid JSON received:", stringifiedData);
      return;
    }

    if (messageObj.action === "displayImage") {
      const code = typeof messageObj.code !== "undefined" ? messageObj.code : 1;
      console.log(`Received displayImage with code ${code}`);
      oscClient.send("/code/section", code, (err) => {
        if (err) console.error("Error sending OSC message:", err);
        else console.log(`OSC message sent: /code/section ${code}`);
      });
    } else if (messageObj.action === "incorrect") {
      const code = typeof messageObj.code !== "undefined" ? messageObj.code : 0;
      console.log(`Received incorrect with code ${code}`);
      oscClient.send("/code/incorrect", code, (err) => {
        if (err) console.error("Error sending OSC message:", err);
        else console.log(`OSC message sent: /code/incorrect ${code}`);
      });
    } else if (messageObj.action === "gameOver") {
      const code = typeof messageObj.code !== "undefined" ? messageObj.code : 0;
      console.log(`Received gameOver with code ${code}`);
      oscClient.send("/code/gameOver", code, (err) => {
        if (err) console.error("Error sending OSC gameOver message:", err);
        else console.log(`OSC gameOver message sent: /code/gameOver ${code}`);
      });
    }
    
    broadcast(ws, stringifiedData, false);
  });

  ws.on("close", () => {
    console.log("Closing connection");
    if (wss.clients.size === 0) {
      console.log("Last client disconnected, stopping keepalive interval");
      clearInterval(keepAliveId);
    }
  });
});

const broadcast = (ws, message, includeSelf) => {
  if (includeSelf) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } else {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
};

const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("ping");
      }
    });
  }, 50000);
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});
