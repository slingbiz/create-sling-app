<div align="center" style={{d}}>
<h1>Create Sling App</h1>
 
 
</div>

<div align="center" style={{d}}>
  <img src="https://sling.biz/assets/images/sling_biz_sling_image.jpg"/>
</div>

<p align="center">
  <strong>
    <a href="https://studio.sling.biz">Live Demo</a>
  </strong>
</p>

 Open source drag and drop frontend CMS in NextJs. Completely customizable Pages Templates & Widgets written in NextJs. Sling is like Strapi for the Frontend or Open source to Builder.io.

## Setting up Sling Project with Hosted Studio
To set up a Sling project locally using Hosted Studio, you'll need the Sling Frontend app and Sling Studio Keys. Follow the steps below:

1. **Sling Frontend App Setup:**
   - Use the [installer](https://www.npmjs.com/package/create-sling-app) to create the Sling Frontend app by running below code:
     
      <code> yarn create sling-app my-project --quickstart </code>

   - Follow the prompts to configure your Sling app.
   - Complete the setup process to have the Sling Frontend App ready. [Refer](#setting-up-sling-frontend-app) to this section to complete the setup.

2. **Obtain Sling Studio Keys:**
   - Sign up for a Sling Studio account if you haven't already on [Sling Studio](https://studio.sling.biz/).
   - Navigate to your account settings or profile section. 
   - Locate the section for accessing or generating Sling Studio Keys.
   - Copy the keys provided and update in the .env for the frontend App.

3. **Play around:**
   - Access Hosted Studio/
   - Create custom widgets and use in your page templates.
   - Modify content from Studio and view 
 

## Setting up Self-Hosted Sling Studio

If you prefer to host Sling Studio on your local machine, you can follow these instructions. Sling consists of three main parts: Sling Studio, Sling API, and Sling FE (please refer to the above instructions for setting up Sling FE locally).

## Setting up [Sling Studio](https://github.com/slingbiz/sling-studio):
1. **Copy Environment File:**
   - Copy `.env.example` to `.env`.

2. **Update Environment Variables:**
   - Update `.env` with values from your Firebase Project Settings. Sling uses firebase for authentication.

3. **Set Default API URL:**
   - Sling Studio defaults to `localhost:10001` as the API URL. You can change this by updating the `.env` file.

4. **Signup and Company Setup:**
   - Visit `/signup` to create a new user in Firebase and the local database.
   - Go to `http://localhost:2021/account-setup` to finish the company setup.
   - Select the Free Tier Plan.
   - Copy the API Key and Update the API key in the Sling frontend (Sling-FE). (e.g., 62d344a2-1ef5-44d4-abd7-9a7597bb8643).

5. **Update Frontend Domain:**
   - Update the Frontend Domain to your local Sling FE. This allows direct access from the Studio to your local Frontend.

## Setting up [Sling API](https://github.com/slingbiz/sling-api):
1. **Clone the code base from the [Git Repo](https://github.com/slingbiz/sling-api)**
   - Copy `.env.example` to `.env`.

2. **Update Firebase Authentication URL:**
   - Update `FIREBASE_AUTH_DB_URL` with the value found in Firebase Project Settings.

3. **Configure MongoDB:**
   - Add your values for MongoDB (`MONGODB_URL` and `MONGODB_DB`). Sling uses MongoDB for storing primary information.

4. **Run Migration Scripts:**
   - Execute migration scripts to set up necessary collections with setup data. Note: Sling does not currently use Mongoose.

5. **Add Service Account Key:**
   - Obtain `serviceAccountKey.json` from Firebase Project Settings -> Service Accounts -> Generate new Private Key. Save the key as JSON in a file.

Once you've completed these steps, your self-hosted Sling Studio and API should be ready to use locally. Happy Slinging!

## Setting up [Sling Frontend App](https://github.com/slingbiz/sling-fe)

To set up the Sling Frontend App, follow these instructions after you have cloned and checked out the [Code](https://github.com/slingbiz/sling-fe) locally.

1. **Copy Environment File:**
   - Copy `.env.example` to `.env`.

2. **Obtain API Key:**
   - Go to Sling Studio -> Settings -> Keys Usage or Local Sling Studio (http://localhost:2021/settings/keys-usage) and copy your API KEY.

3. **Update Environment Variables:**
   - Update `NEXT_PUBLIC_CLIENT_KEY_SECRET` in `.env` with your API Key obtained in the previous step.

4. **Update Client ID:**
   - Update `NEXT_PUBLIC_CLIENT_ID` in `.env` with the email address used to register the new user/company on Sling Studio Web or Local.

5. **Update API URL:**
   - Update `NEXT_PUBLIC_GET_INIT_PROPS` in `.env` to either 'https://sling.biz/api/v1/frontend/getInitProps' if you're using Sling's Hosted Studio, or change it to your local API URL - `http://localhost:10001/api/v1/frontend/getInitProps`. This API URL path is used to fetch and render JSON from the Sling Studio.

Once you've completed these steps, your Sling Frontend App should be ready to use. Happy Slinging!

## Docs

- [Website](https://sling.biz)
- [Documentation](https://sling.biz/documentation/)
- [Demo](https://studio.sling.biz)


## Features :fire:

### It's just React & NodeJs.

No need for complicated plugin systems. Design your editor from top to bottom the same way as you would design any other frontend application in React.
 
### Control how your components are edited

An obvious requirement for page editors is that they need to allow users to edit components. With Sling.biz, you control the React widgets and their props from the Studio directly.
   
## Acknowledgements :raised_hands:

- **[react-dnd](https://github.com/react-dnd/react-dnd)** The React drag-n-drop library.
  Although it is not actually used here, many aspects of Sling.biz are written with react-dnd as a reference along with some utilities and functions being borrowed.

## Getting Help :wave:

If you have questions or there's something you'd like to discuss (eg: contributing), please head over to our [Discord](https://discord.gg/A3skgMEF) server.
