---
title: Connecting to SamePage!
description: General guide of how to connect and start using SamePage!
---

Every application we support natively has what's called a _command palette_. This is a place where users could enter arbitrary commands for the tool to execute certain functionality. SamePage takes advantage of command palettes to integrate its own commands.

To start using SamePage on any given session, the user will need to enter the `Connect to SamePage Network` command. This should set up a connection between the user's Notebook and the rest of the network, catching them up on any events it may have missed since it was offline. Once successful, a `Successfully connected to SamePage Network!` toast notification will appear on the screen alerting the user that they are now online.

If there were any events relevant to the user since they were last online, they will appear in their _SamePage Notifications_. Depending on the application, we will place a SamePage icon somewhere in the application where they could easily access their notifications. If there are any new events, there will be a red dot on the top left of the icon.