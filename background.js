globalThis.messageClients = new Map();

addEventListener("install", async (e) => {
  console.log(e.type);
  e.addRoutes({
    condition: {
      urlPattern: new URLPattern({ hostname: "*" }),
      requestMethod: "post",
    },
    source: "fetch-event",
  });
  e.waitUntil(self.skipWaiting());
});

addEventListener("activate", async (e) => {
  console.log(e.type);
  e.waitUntil(self.clients.claim());
});

addEventListener("fetch", async (e) => {
  if (e.request.url.includes("stream")) {
    e.respondWith((async () =>
      new Response(
        e.request.body
          .pipeThrough(
            new TransformStream({
              async start(controller) {
                globalThis.messageClients.set(e.clientId, controller);
                console.log("start", Object.fromEntries(messageClients));
              },
              async transform(value, controller) {
                // Logic for handling messages from specific WindowClient/Client
                // Do stuff with Uint8Array message from Web page
                console.log(value);
                controller.enqueue(
                  new TextEncoder().encode(
                    new TextDecoder().decode(value).toUpperCase(),
                  ),
                );
              },
              flush() {
                globalThis.messageClients.delete(e.clientId);
                console.log("flush");
              },
            }),
          ),
      ))());
  }
});

async function WebExtensionMessageStream(
  target = "generic",
  id = "chrome.runtime.id",
) {
  const { readable, writable } = new TransformStream();
  function removeFrame(url) {
    const frames = document.querySelectorAll(`[src="${url}"]`);
    frames.forEach((iframes) => {
      iframes.remove();
    });
    return document.querySelectorAll(`[src="${url}"]`).length;
  }
  // Dynamically generate extension ID for path, if necessary:
  // const extensionId = await generateIdForPath("/home/user/WebExtensionMessageStream");
  // const url = new URL(
  //  `chrome-extension://${extensionId}/transferableStream.html`,
  // );
  async function generateIdForPath(path) {
    return [
      ...[
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path)),
        ),
      ].map((u8) => u8.toString(16).padStart(2, "0")).join("").slice(0, 32),
    ].map((hex) => String.fromCharCode(parseInt(hex, 16) + "a".charCodeAt(0)))
      .join("");
  }

  const url = new URL(
    `chrome-extension://${id}/transferableStream.html`,
  );
  return new Promise((resolve) => {
    function handleMessage(e) {
      if (e.origin === url.origin) {
        if (e.data instanceof ReadableStream) {
          resolve({
            readable: e.data.pipeThrough(
              new TransformStream({
                transform(value, controller) {
                  controller.enqueue(value);
                },
                flush() {
                  console.log(removeFrame(url.href));
                },
              }),
            ),
            transferableWindow,
            writable,
          });
          removeEventListener("message", handleMessage);
        } else {
          e.source.postMessage(readable, "*", [readable]);
        }
      }
    }
    addEventListener("message", handleMessage);
    const transferableWindow = document.createElement("iframe");
    transferableWindow.style.display = "none";
    transferableWindow.name = location.href;
    transferableWindow.src = `${url.href}?target=${target}`;
    transferableWindow.addEventListener("load", (e) => {
      // console.log(e);
    });
    document.body.appendChild(transferableWindow);
  }).catch((err) => {
    throw err;
  });
}

chrome.tabs.onUpdated.addListener(async (id, info, tab) => {
  if (info.status === "complete" && !tab.url.startsWith("chrome:")) {
    const script = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (fn, url) => {
        globalThis.WebExtensionMessageStream = new Function(`return ${fn}`)();
        console.log("WebExtensionMessageStream declared");
        return `WebExtensionMessageStream defined globally in ${url}`;
      },
      args: [
        WebExtensionMessageStream.toString().replace(
          /chrome.runtime.id/,
          chrome.runtime.id,
        ),
        tab.url,
      ],
      world: "MAIN",
    });
    console.log(script[0].result);
    //console.log(info, tab);
  }
  // Send message (Uint8Array) to a specific WindowClient or Client
  // messageClients
  //   .get("91af745a-7350-44f2-8910-d70e98fe48fc")
  //   .enqueue(new TextEncoder()
  //     .encode("Message from MV3 ServiceWorker"))
});

chrome.runtime.onInstalled.addListener((reason) => {
  console.log(reason, globalThis.messageClients);
});
