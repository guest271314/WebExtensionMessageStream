addEventListener("load", async (e) => {
  parent.postMessage(null, name);
});

addEventListener("message", async (e) => {
  const response = await fetch(`./?stream=1&target=${new URLSearchParams(location.search).get("target")}`, {
    method: "post",
    body: e.data,
    duplex: "half",
  }).catch(console.warn);
  parent.postMessage(response.body, name, [response.body]);
});
