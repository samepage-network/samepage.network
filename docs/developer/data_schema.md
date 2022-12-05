---
title: Data Schema
description: Learn more about the data model we use to represent pages in SamePage!
---

The data model we use is a variant on [AtJson](https://github.com/CondeNast/atjson), a content format used by the media publisher Condé Nast. The data model is a `JSON` object with a specific schema to adhere to, the definition of which could be found [here](https://github.com/samepage-network/samepage.network/blob/main/package/internal/types.ts). We'll break down each field and sub-field in the `Schema`.

## Content

All the bare content that a page uses is stored as a single string in the top level `content` field. By bare, we intuitively mean what are the characters that the user sees _after_ the host application has already rendered the data to the screen.

For example, let's say our application is a standard Markdown editor and the user types in the following data:

```markdown
Hello **World**
```

The text that a user would see on the screen would be "Hello **World**". So our content value here is going `"Hello World"`.

## Annotations

This is the core idea of our data schema and `AtJson`. Our schema says that all page data is composed of:

1. A string of content
1. A set of annotations decorating that content

Each annotation have the following fields:

- `start` - the index within `content` where this annotation starts.
- `end` - the index within `content` where this annotation ends.
- `type` - the type of annotation it is. We go through all of the different annotation types below.
- `attributes` - the set of properties associated with this annotation. These are universal cross-app properties so they are expected to be implemented by each app's extension. The schema of `attributes` is predefined depending on the `type` of the annotation.
- `appAttributes` - this field could be used by extensions to store attributes about a given annotation that it's app cares about that no other app does. It's an object that maps the app's identifier with a key value object.

Let's use our example to go through each one.

### Positioning

Remember, our markdown is `Hello **World**`, which resolves to a `content` field of `Hello World`.

Since our bolding surrounds the word `World`, we want our `start` and `end` values to use the indices of the `content` field. This indices are zero-indexed:

```json
{
  "start": 6,
  "end": 11
}
```

One important rule to keep in mind is that **annotations are not allowed to be zero length**. Meaning the `start` value cannot equal the `end` value. The reason for this has to do with ambiguity: if you have one annotation at 2,2 and another at 2,3, it's unclear whether the first annotation would be inside or before the second one. Also conceptually speaking, if an annotation is length zero, then it shouldn't be on the page.

The second important rule to note is that order matters. If two consecutive annotations have the same position, than the earlier one always surrounds the later one.

### Types

Next, our `type` field should mark what kind of annotation is. It **must** be a valid value of the list below:

- [block](#block)
- [bold](#bold)
- [italics](#italics)
- [strikethrough](#strikethrough)
- [highlighting](#highlighting)
- [link](#link)
- [reference](#reference)
- [image](#image)
- [custom](#custom)

Continuing our example:

```json
{
  "start": 6,
  "end": 11,
  "type": "bold"
}
```

Note, that the `bold` type doesn't support any attributes. We go through each of the types and the `attributes` they support below.

#### block

Coming Soon...

#### bold

The `bold` type typically refers to adding font weight to the content it's annotating. There are no supported attributes for this type.

#### italics

Coming Soon...

#### strikethrough

Coming Soon...

#### highlighting

Coming Soon...

#### link

Coming Soon...

#### reference

Coming Soon...

#### image

Coming Soon...

#### custom

The `custom` annotation is an escape hatch for extensions to implement whichever other annotation would be useful for their app that isn't universally supported. This combined with the `appAttributes` field below should be ignored by extensions as updates are made. The `custom` annotation supports the following attributes:
- `name` - The name assigned to this custom annotation, so that apps could handle accordingly.

### App Attributes

The `appAttributes` field is an excape hatch for applications to enter data that only pertains to its application and no other ones on the network. Using our previous example, let's say our app has a special bolding character where `Hello &&World&&` was also bolded the word `World`. For full data integrity, we need to know when we see the `bold` attribute, whether to deserialize as a pair of asterisks (`**`) or a pair of ampersands (`&&`). We could use `appAttributes` to denote this:

```json
{
  "start": 6,
  "end": 11,
  "type": "bold",
  "appAttributes": {
    "specialapp": {
      "kind": "&"
    }
  }
}
```

## Content Type

This is the last field used in the data schema, to help identify what version of the schema the given page is using. The following is the latest supported value at the moment:

```javascript
`application/vnd.atjson+samepage; version=2022-12-05`;
```

The version field at the end is subject to change as we iterate on the schema. This makes it possible for extensions to detect data and migrate accordingly if it detects older schemas.

Putting our `Hello &&World&&` example together, it would have the following final data representation:

```json
{
  "content": "Hello World",
  "annotations": [
    {
      "start": 6,
      "end": 11,
      "type": "bold",
      "appAttributes": {
        "specialapp": {
          "kind": "&"
        }
      }
    }
  ],
  "contentType": "application/vnd.atjson+samepage; version=2022-12-05"
}
```

### Differentiating Content Types

There are few important types to become familiar with:
- `InitialSchema` - An intemediary representation used by extensions to actually calculate and apply the related data. This type only contains the `content` and `annotations` fields.
- `LatestSchema` - This is the latest version of the schema that is actually stored in IPFS. The data is wrapped by [Automerge](https://automerge.org/docs/types/values/) utilities to assist in conflict resolution and history management.
- `V*Schema` - Previous versions of `LatestSchema` that can be found stored in IPFS.
- `Schema` - Conjuction of `LatestSchema` and all `V*Schema`s. This data type represents all of the possibilities stored in IPFS - the `unwrapSchema` utility helps convert this data into the `InitialSchema` intermediate data type.
