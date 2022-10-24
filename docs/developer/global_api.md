---
title: Global API
description: The public facing API SamePage exposes for other extensions.
---

Out of the box, SamePage extensions comes with just the `Share Page` protocol. It exposes methods though for other extensions that developers could use to add other protocols to SamePage.

SamePage extensions attaches this API onto the `window.samepage` object. This allows the methods to be global variables that other extensions could invoke to implement their protocols.

When trying to access the API from other extensions, you must be careful about race conditions. Unless you have some way to guarantee extension ordering on user's devices, your extension could load before the `window.samepage` object has been set, leading to `undefined` errors. To help with this, SamePage extensions dispatch a `samepage:loaded` custom DOM event to the `document.body`. Extensions could then listen for this event before accessing the API to safely ensure its availability.

The `@samepage/external` NPM package is the team managed suite of utilities SamePage supports to help developers build `SamePage` compatible extensions. It has a helper function that provides one such implementation for accessing the API, which you could view [here](https://github.com/vargasarts/samepage.network/blob/main/package/external/getSamePageAPI.ts). Below is an example of how to use it.

```typescript
import getSamePageAPI from "@samepage/external/getSamePageAPI";

getSamePageAPI().then((api) => {
  // do stuff with `api`
});
```

Below we outline the methods within the public API.

## `addNotebookListener`

SamePage extensions will manage a web socket connection and handle messages from that connection automatically. Messages will typically be `JSON` strings with an `operation` field, which is used to route the message to the appropriate handler. External extensions could use `addNotebookListener` to add more message handlers to that routing.

```typescript
const { addNotebookListener } = api;

addNotebookListener({
  operation: "EXAMPLE_PING"; // operation to listen for
  handler: (
    data,   // json object
    source, // notebook that sent the message
    uuid,   // universal id of the message
  ) => {
    const {
        uuid,      // uuid string
        workspace, // workspace name string
        app,       // app id number
    } = source
    // do stuff with `data`
  }
});
```

Note that this method will overwrite any existing handlers, including ones defined by SamePage extensions themselves. This is why it's typically good practice to define your operations with a prefix corresponding to the name of your extension, for example `EXAMPLE_`.

## `removeNotebookListener`

Removes any predefined listeners. This method is useful if you want to define messages in your protocol that should only be listened to a certain number of times before removing itself.

```typescript
const { addNotebookListener, removeNotebookListener } = api;

addNotebookListener({
  operation: "EXAMPLE_PING_ONCE";
  handler: () => {
    console.log("ping!");
    removeNotebookListener({
      operation: "EXAMPLE_PING_ONCE",
    })
  }
});
```

## `sendToNotebook`

Both of the methods above have to do with what to do when the notebook your extensions serves _receives_ data. The `sendToNotebook` helper is how you can _send_ data to other notebooks. Note that you'll need the target Notebook's Universal Id in order to send it the data.

```typescript
const { sendToNotebook } = api;

sendToNotebook({
    // operation to send to another notebook
    operation: "EXAMPLE_PING",                       
    // Notebook Universal ID for the target notebook
    target: "abcd1234-abcd-1234-abcd-1234abcd1234",  
    // JSON to send
    data: {},                                        
})
```

Note that the following fields are needed for routing the message through SamePage's protocol and therefore should not be used in the `data` field of this method:
- `app`
- `workspace`
- `operation`
- `notebookUuid`
