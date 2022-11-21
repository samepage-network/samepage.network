---
title: References
description: Things to keep in mind when dealing with cross notebook references
---

One of the most powerful features SamePage unlocks is the ability to reference data in other notebooks.

SamePage is automating a ton of complexity when trying to execute a cross notebook reference. SamePage-compatible applications could come in all shapes and sizes: from local-only to hosted apps with an API. Understanding the nuances of how they work will inform how to use them effectively and what to do when a cross notebook reference is not appearing as you would expect it to.

## Notebook Page Ids

When you connect your notebook to SamePage, it gets assigned a Universal Notebook Id. SamePage also keeps track of each shared page within a notebook by using `Notebook Page Ids`. A notebook page id differs from application to application, for example:
- In Roam, this could be a page title or a block reference
- In LogSeq, this could be a page name or a block uuid
- In Obsidian, this could be a file name or a reference at the end of a block

These are the two parts that make up cross notebook reference.
- The Notebook Universal Id tells SamePage "where in the universe can I find this notebook"
- The Notebook Page Id tells SamePage "where in the notebook can I find this data"

In each of the SamePage extensions, this will appear in your notebook as some variant of `notebook-universal-id:notebook-page-id`, depending on the feature set of the application for your notebook. Cross notebook references will appear when pages that are not shared on SamePage are referenced from within a Shared Page

## Loading Data

The content for a cross notebook reference lives in another notebook. Because of this, there is a workflow the SamePage extension undergoes on both ends in order to have the data appear in your notebook:

![](/images/basics/crossRefDiagram.png)

A breakdown of what's going on in this diagram:
1. Your notebook tries to display a cross notebook reference, which doesn't live in your notebook. It asks SamePage for it.
1. SamePage knows where to find that notebook because it's in the network, and asks that notebook what's behind the reference.
1. The other notebook which also has the SamePage extension on will know what's behind the reference and send it back to SamePage. SamePage saves a copy so that if this other notebook is ever offline, your notebook knows how to display it.
1. Your notebook receives the data from SamePage and displays it to you in your application

Note that the other notebook needs to be on line _at some point_ in order for your notebook to know how to display the data.

## External vs. Internal vs. Shared references

Up to this point we have only discussed external references - referenced content that lives primarily in another notebook. Internal references are ones that live primarily on your notebook, usually displayed as `[[wikilinks]]`. There's one more type of reference which are _Shared_ references - references that live in multiple notebooks and have been shared with SamePage.

If a reference points an id that is already shared on SamePage, the extension in your notebook will convert the id from an external-looking reference to an internal-looking one.

For example, let's say I have a page called `Meeting` in my notebook, and you have a page called `Reunión` in yours and we linked together these two via the sharing pages feature. If we have another page called `Daily Updates` that we shared, and in it I write `[[Meeting]]` in my notebook, it should appear as `[[Reunión]]` in your notebook.

What's happening here is we are _translating references_ between what my notebook means to refer to and yours. This allows each of our applications to still handle the references internally in a way that's natural, while still allowing consistent syncing to occur between our applications.
