---
title: Network Architecture
description: In-depth guide on the backend serving the SamePage clients
---

SamePage's network is run by a series of serverless lambda functions that are connected to two different API gateways:
1. A REST gateway
1. A WebSocket gateway

These gateways make up SamePage's business model. They respond to requests from notebooks and facilitate communication between notebooks. The REST gateway is mostly responsible for receiving messages from notebooks into the network. The WebSocket gateway is mostly responsible for sending messages from the network to the notebooks.

## The REST Gateway

As mentioned above, the REST gateway receives messages from notebooks into the network. It is reachable from `https://api.samepage.network`.

### POST /page

Coming soon...

## The WebSocket Gateway

Coming soon...
