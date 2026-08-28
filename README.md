
<div align="center">
  <h1>Create Sling CMS App</h1>
</div>

<div align="center">
  <img src="https://sling.biz/assets/images/sling_biz_sling_image.jpg"/>
</div>

<p align="center">
  <strong>
    <a href="https://studio.sling.biz/create">Live Create</a>
  </strong>
</p>

Sling CMS is the open source governed AI CMS. Describe a page, get widgets you govern, a template, and a unique URL.

## Prerequisites

- Node.js 18 or greater
- MongoDB (self-host only). If you have none, the installer starts it in Docker. No Docker? Install Docker Desktop, install Mongo locally, or paste a free [Atlas](https://cloud.mongodb.com) URI.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (self-host Create)

## Quick start

```sh
npx create-sling-app my-site
```

or

```sh
yarn create sling-app my-site
```

Do not run `npm i create-sling-app`. That installs a library; it does not scaffold a project.

### Hosted Studio

Picks the hosted option, clones the storefront, and points at [studio.sling.biz](https://studio.sling.biz/create). Paste keys from Settings after signup.

### Self-hosted Studio

Picks self-hosted. Clones Studio, API, and the storefront. You bring MongoDB and a Gemini key. Create is unlimited on your box (`GENERATE_DAILY_LIMIT=0`).

Sign up in Studio, then open the storefront. One company is picked automatically. A second company: paste that company’s key from Settings → Keys into `sling-fe/.env` and restart.

Open:

- Create: `http://localhost:2021/create`
- API: `http://localhost:10001`
- Storefront: `http://localhost:4087`

## Docs

- [Website](https://sling.biz)
- [Documentation](https://sling.biz/documentation/)
- [Studio](https://studio.sling.biz)

## Help

[GitHub issues](https://github.com/slingbiz/sling/issues) or [ankur@sling.biz](mailto:ankur@sling.biz).
