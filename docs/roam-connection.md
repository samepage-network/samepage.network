---
title: SamePage Docs - Roam Connection
description: How to connect two Roam graphs using the SamePage Network 
---

The SamePage Network allows you to send messages to other notebooks while they are online or offline. This characteristic brings with it special features like the ability to do live page-sharing, multiplayer editing, and cross-notebook queries. 

<!-- Check out our Message Directory to check out all of the messages you can send between notebooks! (waiting on this til it's built) -->

## Setup
You can connect to the SamePage network by hitting 'Connect to SamePage Network' from the Roam Command Palette (⌘-P or cmd-P):

<!-- Add video demo -->

Now that you are connected to the SamePage Network, you will be able to share data with other notebooks.

## Auto Connection
By default, your graph will not connect to the SamePage Network. You can enable default auto connection by checking the 'Auto Connect' flag in the SamePage tab in your Roam Depot settings:

<!-- Add video demo -->

If your graph does not connect automatically, you can connect at anytime with the 'Connect to SamePage Network' command.

## Disconnection
The SamePage Network will automatically disconnect if it senses inactivity for 10 minutes. To manually disconnect, enter the 'Disconnect from SamePage Network' command into the Roam command palette. If two graphs within the same network are online at the same time, SamePage will automatically try to connect in a peer-to-peer manner. This allows messages to be sent directly from one graph to the other for free since no data is stored in the SamePage Network backend.
