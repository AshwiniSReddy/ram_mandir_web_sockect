// const http = require("http");
// const express = require("express");
// const app = express();

// app.use(express.static("public"));
// // require("dotenv").config();

// const serverPort = process.env.PORT || 3000;
// const server = http.createServer(app);
// const WebSocket = require("ws");

// let keepAliveId;

// const wss =
//   process.env.NODE_ENV === "production"
//     ? new WebSocket.Server({ server })
//     : new WebSocket.Server({ port: 5001 });

// server.listen(serverPort);
// console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`);

// wss.on("connection", function (ws, req) {
//   console.log("Connection Opened");
//   console.log("Client size: ", wss.clients.size);

//   if (wss.clients.size === 1) {
//     console.log("first connection. starting keepalive");
//     keepServerAlive();
//   }

//   ws.on("message", (data) => {
//     let stringifiedData = data.toString();
//     if (stringifiedData === 'pong') {
//       console.log('keepAlive');
//       return;
//     }
//     broadcast(ws, stringifiedData, false);
//   });

//   ws.on("close", (data) => {
//     console.log("closing connection");

//     if (wss.clients.size === 0) {
//       console.log("last client disconnected, stopping keepAlive interval");
//       clearInterval(keepAliveId);
//     }
//   });
// });

// // Implement broadcast function because of ws doesn't have it
// const broadcast = (ws, message, includeSelf) => {
//   if (includeSelf) {
//     wss.clients.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(message);
//       }
//     });
//   } else {
//     wss.clients.forEach((client) => {
//       if (client !== ws && client.readyState === WebSocket.OPEN) {
//         client.send(message);
//       }
//     });
//   }
// };

// /**
//  * Sends a ping message to all connected clients every 50 seconds
//  */
//  const keepServerAlive = () => {
//   keepAliveId = setInterval(() => {
//     wss.clients.forEach((client) => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send('ping');
//       }
//     });
//   }, 50000);
// };


// app.get('/', (req, res) => {
//     res.send('Hello World!');
// });



const http = require("http");
const express = require("express");
const app = express();

app.use(express.static("public"));
// require("dotenv").config();

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");
const osc = require("node-osc");

// Create an OSC client that sends messages to TouchDesigner.
// Replace '192.168.1.100' with the IP address of your TouchDesigner machine,
// and 8000 with the port TouchDesigner is listening on for OSC.
const oscIP = "192.168.0.140";
const oscPort = 7000;
const oscClient = new osc.Client(oscIP, oscPort);
console.log(oscClient,"osc clict")

let keepAliveId;

const wss =
  process.env.NODE_ENV === "production"
    ? new WebSocket.Server({ server })
    : new WebSocket.Server({ port: 5001 });

server.listen(serverPort);
console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`);

wss.on("connection", function (ws, req) {
  console.log("Connection Opened");
  console.log("Client size: ", wss.clients.size);

  if (wss.clients.size === 1) {
    console.log("first connection. starting keepalive");
    keepServerAlive();
  }

  ws.on("message", (data) => {
    let stringifiedData = data.toString();
    if (stringifiedData === "pong") {
      console.log("keepAlive");
      return;
    }

    // Try to parse the incoming message as JSON
    let messageObj;
    try {
      messageObj = JSON.parse(stringifiedData);
    } catch (error) {
      console.error("Invalid JSON:", stringifiedData);
      return;
    }

    // Check for different actions from the quiz app
    if (messageObj.action === "displayImage") {
      console.log(`Received displayImage for level ${messageObj.level}`);
      // Send an OSC message to TouchDesigner with address "/temple/section" and argument level
      oscClient.send("/temple/section", messageObj.level, (err) => {
        if (err) console.error("Error sending OSC message:", err);
        else console.log(`OSC message sent: /temple/section ${messageObj.level}`);
      });
    } else if (messageObj.action === "incorrect") {
      console.log(`Received incorrect for level ${messageObj.level}`);
      // Optionally, send an OSC message for incorrect answers
      oscClient.send("/temple/incorrect", messageObj.level, (err) => {
        if (err) console.error("Error sending OSC message:", err);
        else console.log(`OSC message sent: /temple/incorrect ${messageObj.level}`);
      });
    }
    
    // Optionally, broadcast the message to other connected clients if needed
    broadcast(ws, stringifiedData, false);
  });

  ws.on("close", (data) => {
    console.log("Closing connection");

    if (wss.clients.size === 0) {
      console.log("Last client disconnected, stopping keepalive interval");
      clearInterval(keepAliveId);
    }
  });
});

// Broadcast function: sends a message to all clients (or all except the sender)
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

/**
 * Sends a ping message to all connected clients every 50 seconds.
 */
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
