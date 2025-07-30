# MongoDB Atlas Setup Guide

This guide provides detailed instructions for setting up MongoDB Atlas for the Zoracle Telegram Bot.

## 1. Create a MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up or log in.
2. Once logged in, you'll be taken to the MongoDB Atlas dashboard.

## 2. Create a Project

1. Click on the "Projects" dropdown in the top navigation bar.
2. Click "New Project".
3. Enter a project name (e.g., "Zoracle Bot").
4. Click "Next".
5. Add project members if needed (optional).
6. Click "Create Project".

## 3. Create a Cluster

1. In your new project, click "Build a Database".
2. Select "FREE" tier (M0 Sandbox).
3. Choose a cloud provider (AWS, Google Cloud, or Azure) and a region closest to your users.
4. Click "Create Cluster".
5. Wait for the cluster to be provisioned (this may take a few minutes).

## 4. Configure Network Access

1. In the left sidebar, click "Network Access" under "Security".
2. Click "Add IP Address".
3. You have two options:
   - **For development**: Click "Allow Access from Anywhere" (not recommended for production).
   - **For production**: Add specific IP addresses that should have access.
4. Click "Confirm".

## 5. Create a Database User

1. In the left sidebar, click "Database Access" under "Security".
2. Click "Add New Database User".
3. Choose "Password" for Authentication Method.
4. Enter a username and a secure password.
5. Under "Database User Privileges", select "Read and write to any database".
6. Click "Add User".

## 6. Get Connection String

1. In the left sidebar, click "Database" under "Deployments".
2. Click "Connect" on your cluster.
3. Select "Connect your application".
4. Choose your driver version (Node.js and version 4.1 or later).
5. Copy the connection string.
6. Replace `<password>` with your database user's password.
7. Replace `<dbname>` with `zoracle`.

## 7. Add Connection String to .env File

Add the connection string to your `.env` file:

```
MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/zoracle?retryWrites=true&w=majority
```

Replace `username`, `password`, and the cluster address with your actual values.

## 8. Test the Connection

Run the test script to verify the connection:

```bash
npm run db:test
```

You should see a success message if the connection is working properly.

## 9. Initialize and Seed the Database

Once the connection is working, initialize and seed the database:

```bash
npm run db:init
npm run db:seed
```

## Troubleshooting

### Connection Errors

If you see a connection error like:

```
MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted.
```

1. Check that your IP address is whitelisted in the Network Access settings.
2. Verify that your username and password are correct in the connection string.
3. Make sure you've replaced `<password>` in the connection string with your actual password.
4. Check that your internet connection is working properly.

### Authentication Errors

If you see an authentication error:

```
MongoError: Authentication failed
```

1. Double-check your username and password in the connection string.
2. Make sure the database user has the correct permissions.
3. Try creating a new database user and updating the connection string.

### Database Name Issues

If you're connecting but can't access your data:

1. Make sure you've specified the correct database name in the connection string.
2. Check that you've initialized the database with `npm run db:init`.
3. Verify that your database user has read and write permissions. 