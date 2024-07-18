<div align="center">
  <h1>Create Sling App</h1>
</div>

<div align="center">
  <img src="https://sling.biz/assets/images/sling_biz_sling_image.jpg"/>
</div>

<p align="center">
  <strong>
    <a href="https://studio.sling.biz">Live Demo</a>
  </strong>
</p>

Open source drag and drop frontend CMS in NextJs. Completely customizable Pages, Templates & Widgets written in NextJs. Sling is like Strapi for the Frontend or Open source to Builder.io.

## Features :fire:

- **It's just React & NodeJs**: No need for complicated plugin systems. Design your editor from top to bottom the same way as you would design any other frontend application in React.
- **Control how your components are edited**: With Sling.biz, you control the React widgets and their props from the Studio directly.

## Prerequisites

To properly set up Sling, you need:

- **MongoDB URI**: Make sure you have a MongoDB instance running and obtain its URI.
- **Node.js**: Ensure you have Node.js version 18 or greater installed.

## Setting up Sling Project with Hosted Studio

To set up a Sling project locally using Hosted Studio, follow these steps:

### Sling Frontend App Setup

1. **Use the Installer**:
   - Create the Sling Frontend app by running the following command:
     ```sh
     yarn create sling-app my-project
     ```

2. **Follow the prompts to configure your Sling app.**

3. **Complete the setup process**:
   - Refer to the [Setting up Sling Frontend App](#setting-up-sling-frontend-app) section to complete the setup.

### Obtain Sling Studio Keys

1. **Sign up for a Sling Studio account**:
   - Visit [Sling Studio](https://studio.sling.biz/) to sign up.

2. **Access or generate Sling Studio Keys**:
   - Navigate to your account settings or profile section.
   - Locate the section for accessing or generating Sling Studio Keys.
   - Copy the keys provided and update them in the `.env` file for the frontend app.

### Play around

1. **Access Hosted Studio**.
2. **Create custom widgets** and use them in your page templates.
3. **Modify content from Studio** and view the changes.

## Setting up Self-Hosted Sling Studio

If you prefer to host Sling Studio on your local machine, follow these instructions. Sling consists of three main parts: Sling Studio, Sling API, and Sling FE.

### Setting up [Sling Studio](https://github.com/slingbiz/sling-studio)

1. **Copy Environment File**:
   ```sh
   cp .env.example .env
