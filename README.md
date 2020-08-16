# google-drive-utils

Status: Work In Progress

## Description

Utils for Google Drive API to get rid of boilerplate code duplicates in projects.
Implementation of routine tasks migrating from one project to another. 

## Features

* Google Auth with default project credentials.
* Get file IDs list by name.
* Create new Google Sheets file.
* Delete file.
* Delete existing files with same name.
* New functions will be added as soon as new requirements arise.

##### Additional

* NodeJS
* TypeScript
* Google Drive API
* [xojs/xo](https://github.com/xojs/xo) with plugins for TypeScript - linting in CLI
* [ESLint](https://github.com/eslint/eslint) - linting in the WebStorm with [ESLint plugin](https://plugins.jetbrains.com/plugin/7494-eslint)

## Installation

```
npm install --save google-drive-utils
```

## Usage

1. Add your Google Service account to the Google Drive folder editors role.

2. Enable Google Drive API in your project.

3. Add file `default-credentials.json` with google cloud service account auth key to the root of project. 
This file could be downloaded from Google Cloud IAM console or Firebase Console. 

4. Add `.env` file with contents:
    ```
    GOOGLE_APPLICATION_CREDENTIALS=default-credentials.json
    ```

5. Add `env-cmd` package to the project
    ```
    npm install --save-dev env-cmd
    ```

6. Add `google-drive-utils` to the project
    ```
    npm install --save google-drive-utils
    ```

7. Run project with `env-cmd`. Example for cloud functions below:
    ```
    env-cmd npx @google-cloud/functions-framework --target=index --function-signature=myFunction
    ```

##### Code Example:
```typescript
import {GoogleDriveUtils} from 'google-drive-utils';

const utils = await GoogleDriveUtils.create(); // or getInstance() if you want to use a singleton across the project.
console.log(await utils.getFileIdsByName('somefilename', 'some-directory-id'));
console.log(await utils.deleteExistingFiles('somefilename', 'some-directory-id'));

// have a look at GoogleDriveUtils class for more helpful methods
```

## License

MIT (c) 2020 Viacheslav Dobromyslov <<viacheslav@dobromyslov.ru>>
