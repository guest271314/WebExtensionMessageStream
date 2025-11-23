### WebExtensionMessagingStream

## Explainer

### Problem

No standardized Web Extension API to send or transfer `TypedArray`s or `ArrayBuffer`s or
`ReadableStream`s or `TransformStream`s to and from MV3 Web Extensions from arbitrary Web pages.

### Solution

#### Chromium based browsers (Chromium, Chrome, Brave, Opera, Edge)

Define `"web_accessible_resources"` in `manifest.json`; use `iframe` appended
to arbitrary Web page to establish a `WindowClient` in `ServiceWorker` context;
use Transferable Streams with `postMessage(readable, "*", [readable])` to
transfer a `ReadableStream`	from the Web page to the `FetchEvent` in 
`ServiceWorker` which becomes a full-duplex stream due to Chromium's use of Mojo
between `WindowClient` and `CLient` and `fetch` event to handle `fetch()`.

### Implementation details

Internally Chromium has full-duplex stream capabilities between `WindowClient`
and `Client` of `ServiceWorker` via Mojo. We use this to initialize a `TransformStream`
with `writable` side the arbitrary Web page, and `readable` side sent to 
`ServiceWorker` as a streaming request with `fetch()` and `duplex: "half"` `RequestInit`
option set.

When the `writable` side gets a `WritableStreamDefaultWriter`, data in the 
form of `Uint8Array` written to `write()` is sent to the streaming request
and read in the `ServiceWorker` `fetch` event, where any data can be enqueued
into the `TransformStreamDefaultController` and sent to the `WindowClient` (`iframe`)
where we read the data sent from the `ServiceWorker`.

The `ServiceWorker` is persistent, remains active due to the fact we have a
live `WindowClient` and an indefinite `fetch()` request being handled by `fetch`
event handler.

Since we have a `WindowClient` we have an `id` for the `iframe` nested context,
so we can send messages to the arbitrary Web page that initiated a `fetch()`
request from the `ServiceWorker` by filtering client `id`s, without necessarily 
waiting on messages from the client.

Something like

```js
for (const [id, controller] of messageClients) {
  controller.enqueue(new TextEncoder().encode(id));
  console.log(await clients.get(id));
}
```

If we add a query string to the URL used to request the Web extension
web accessible resources `iframe`, we add citeria to filter further,
if needed

```js
const { readable, writable, transferableWindow } = await WebExtensionMessageStream(location.host) // optional;
```

Multiple `iframe`s can be appended to the same Web page, and multiple discrete Web pages.

Removing the `iframe` from the Web page closes the messaging session, and
results in a network type error because we have abruptly aborted the 
`fetch()` request. We can probably handle that a little differently using `AbortController`,
if we wanted to.

We'll use a modern design for full-duplex asynchronous messaging in the form of a WHATWG `TransformStream`, similar to the design used by `WebSocketStream`,
`WebTrasnport`.

### Usage

```
const encoder = new TextEncoder();
const { readable, writable, transferableWindow } = await WebExtensionMessageStream(location.host) // optional;
const writer = writable.getWriter();
readable.pipeThrough(new TextDecoderStream()).pipeTo(
  new WritableStream({
    write(message) {
      console.log(message);
    },
    close() {
      console.log("Stream close");
    },
    abort(reason) {
      console.log(reason);
    },
  }),
).then(() => console.log("Done streaming"))
.catch((e) => {
  console.log(e); 
})
.finally(() => {
  console.log("WebExtensionMessageStream closed");
});

await writer.ready;
await writer.write(encoder.encode(`Message from ${document.title}`));
```

Later 

```
await writer.close();
```
### References
- https://issues.chromium.org/issues/40321352
https://groups.google.com/a/chromium.org/g/blink-network-dev/c/9MKtF4fPtMA?pli=1
- https://docs.google.com/document/d/1_KuZzg5c3pncLJPFa8SuVm23AP4tft6mzPCL5at3I9M/edit?pli=1&tab=t.0#heading=h.ctj5hkqmripj
- https://issues.chromium.org/issues/40597904
- https://github.com/whatwg/streams/blob/dd4e1806f894eff6ba006fb3c96657b8b104263b/explainers/transferable-streams.md
- https://groups.google.com/a/chromium.org/g/chromium-dev/c/I_hfhGILbDc/m/OVlsxYjUBAAJ
- https://chromium.googlesource.com/chromium/src/+/main/mojo/README.md
- https://github.com/chromium/chromium/blob/5a06296706a275b6539c39acedb0dc09a18b8543/content/browser/service_worker/service_worker_fetch_dispatcher.cc
- https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
## License

Do What the Fuck You Want to Public License [WTFPLv2](http://www.wtfpl.net/about/)

