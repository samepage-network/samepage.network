---
title: Why does SamePage use Web3?
description: A core feature of SamePage, but not one users have to think about until they have to.
date: 2022-12-06
author: Vargas
type: Product
---

One of the design goals for SamePage is to be able to bring Web3 to the users of Web2 applications, without it being the main focus. So much of the Web3 industry today is in service to other organizations in Web3. At SamePage, we believe that this trend has held the industry back from serving everyday users.

So while this underlying technology is not the focus for what we do at SamePage, we believe it's important to explain _why_ we need Web3 in order to build a protocol for thought.

## Import/Export Problem
There has been much said about the recent [FTX bankruptcy](https://www.nytimes.com/2022/11/11/business/ftx-bankruptcy.html), but we want to focus on one key sin. Customers of FTX could not withdraw their funds. This is because while they were a business that dealt with trading cryptocurrency assets, they themselves were not a Web3 company. That data wasn't _owned_ by users. Users needed to _export_ then _import_ their data else-where (and in this case, data = money).

In order to be a protocol for thought, we cannot own user data. If users require SamePage as a company to be in good standing with local laws in order to access their data, then they are not in control. They cannot collaborate with users of _other_ applications.

By backing up user data to [IPFS](https://ipfs.io), anything could happen to SamePage the company and users will still be able to access their data from whichever tool for thought they are currently using (or want to use next). For those who are unfamiliar, IPFS is a decentralized storage protocol, where over 200K independent computers are working together to store and serve data.

Some companies try to provide features to mitigate this. Roam offers automatic backups to a location of your choosing. LogSeq and Obsidian run their applications as local first. But all three require a _location_ to _export_ your data from (Roam servers in the former, your machine in the latter). With Web3, your data is _location independent_, served by thousands of computers all over the world to be accessible from anywhere by a uniquely identifiable, immutable link. It's an approach that the internet itself is built on.

## Open Source
Your data stored on a decentralized set of servers is nice, but what happens if it's stored in a way that's impossible to read? Consistent with the values of Web3, this is why all code used by SamePage is and will forever be **open source**.

With the data serialization logic consistently published in our [public repositories](https://github.com/samepage-network/repositories), users do not need to use an official SamePage extension to access the data. If pricing becomes too steep on SamePage's network, then others can provide their own communication layer. SamePage is simply pioneering the _language_ used between applications. We're pioneering this through publishing our version of SamePage extensions for each application, but they are by no means the only ones users have to use in order to interact on the network.

This open source philosophy ensures that users maintain control over how they collaborate with each other and that developers of future tools for thought can learn how to integrate on their own.

## Web3 changes how we approach application data
The big question that critics and investors of web3 love to ask is some form of, "Why does your product _need_ Web3?" Here's the uncomfortable answer that those building in the space don't want to confront: no product, technically speaking, _needs_ it.

Every product in Web3 can technically run as a single trusted, centralized server. The benefit Web3 brings isn't a technical one because single servers will always serve technical use cases more efficiently than decentralized ones. The benefit is political: instead of having to trust a single company (risk of bankruptcy) or trust just yourself (risk of user error) with your data, you can trust _the world_.

This shifts our applications from serving **platform-owned** to **user-owned** data. In Web3, the rest of the world comes to a consensus over who owns what data, instead of individual companies. This makes their data accessible for any future application that the user wants to try.

Without this philosophy, SamePage would be no different from any of the other existing tools for thought.
