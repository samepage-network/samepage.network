---
title: Sharing Pages
description: How to share a page with another notebook
---

Now that you are all set up on SamePage, you will be able to share pages from your notebook with someone else's notebook. Once the shared page is live, changes that either of you make to your respective notebooks will be made in the other!

The docs below should apply to all SamePage supported extensions. For application specific nuances, be sure to visit the docs for each app.

## Initializing a Shared Page

The SamePage extension will add a command to your application's command palette titled `Share Page on SamePage`. Navigate to a page you want to share and enter that command. You should see a success notification toast and immediately see a modal to invite other notebooks to the page:

![](/images/docs/basics/sharePageOnSamePage.png)

This modal is aware of all of the notebooks that are a part of the SamePage network. By connecting to SamePage, you are consenting to your notebook name to also be discoverable on this modal.

Remember that a notebook is composed of two parts - a workspace name and an application. This is similar to email being composed of the user name `@` mail server. Using the notebook's workspace and application, you could use this modal to search for the notebook you'd like to share this page with and hit enter. You can add several notebooks to share the page with at once. When you are ready, click the `plus` on the right side of the modal to share the page with the other notebooks!

![](/images/docs/basics/sharedPages.png)

You can revoke access at any time before a notebook has accepted the invite by clicking the trash icon next to each notebook name:

![](/images/docs/basics/pendingInvites.png)

## Shared Page Status Bar

Once a page is initialized on SamePage, a status bar should appear beneath the page title for the page:

![](/images/docs/basics/status.png)

The icons after the SamePage logo from left to right are as follows:

- `Invite Notebook` – This triggers the same modal from the initialization step for sharing a page with more notebooks.
- `View History` – This opens a sidebar of all versions of your shared page, with clickable snapshots of the data.
- `Disconnect Shared Page` – This will disconnect your notebook from the shared page. Note: this **does not delete** the page from being available on the decentralized web. It merely disconnects the page in _your_ notebook from receiving future updates.
- `Manual Sync` – In case there are any errors that occur with syncing data across notebooks, this icon is an escape hatch, allowing users to forcibly sync their version of the data

## Accepting Shared Pages

Coming Soon...
