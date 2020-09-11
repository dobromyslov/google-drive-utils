import {drive_v3, google} from 'googleapis';
import {drive} from 'googleapis/build/src/apis/drive';
import {GoogleAuth, GoogleAuthOptions, OAuth2Client} from 'google-auth-library';
import {Readable} from 'stream';
import fetch from 'node-fetch';

export class GoogleDriveUtils {
  /**
   * Singleton instance.
   */
  protected static instance?: GoogleDriveUtils;

  /**
   * Authentication options used on first singleton initialization.
   */
  protected static singletonGoogleAuthOptions?: GoogleAuthOptions;

  /**
   * Google Drive API instance.
   */
  protected api: drive_v3.Drive;

  /**
   * Instantiates Google Drive API with authentication.
   * Use GoogleDriveUtils.create() async static method to authenticate and create new instance
   * or GoogleDriveUtils.getInstance() if you need a singleton.
   * @param auth
   */
  protected constructor(auth: GoogleAuth | OAuth2Client | string) {
    this.api = drive({version: 'v3', auth});
  }

  /**
   * Authenticates and creates new instance.
   * Use GoogleDriveUtils.getInstance() if you need a singleton instance.
   * @param googleAuthOptions [OPTIONAL] Authentication options.
   *                                     Default auth scope is https://www.googleapis.com/auth/drive.file
   *                                     See https://developers.google.com/identity/protocols/oauth2/scopes#drive
   */
  public static async create(googleAuthOptions?: GoogleAuthOptions): Promise<GoogleDriveUtils> {
    // Set default auth scope
    googleAuthOptions = googleAuthOptions ?? {};
    googleAuthOptions.scopes = googleAuthOptions.scopes ?? ['https://www.googleapis.com/auth/drive'];

    const auth = await google.auth.getClient(googleAuthOptions);
    return new GoogleDriveUtils(auth);
  }

  /**
   * Creates or gets singleton instance.
   * Use GoogleSheetsUtils.create() if you need new instance.
   * @param googleAuthOptions [OPTIONAL] Authentication options.
   *                                     Default auth scope is https://www.googleapis.com/auth/drive.file
   *                                     See https://developers.google.com/identity/protocols/oauth2/scopes#drive
   */
  public static async getInstance(googleAuthOptions?: GoogleAuthOptions): Promise<GoogleDriveUtils> {
    if (!GoogleDriveUtils.instance) {
      GoogleDriveUtils.instance = await GoogleDriveUtils.create(googleAuthOptions);
      GoogleDriveUtils.singletonGoogleAuthOptions = googleAuthOptions;
    } else if (googleAuthOptions && JSON.stringify(googleAuthOptions) !== JSON.stringify(GoogleDriveUtils.singletonGoogleAuthOptions)) {
      throw new Error(
        'Singleton instance has been already created with authOptions. ' +
        'Please use GoogleDriveUtils.create() to create another instance with new different auth options.'
      );
    }

    return GoogleDriveUtils.instance;
  }

  /**
   * Returns list of file IDs for the specified name.
   * @param filename name to search
   * @param directoryId parent directory to search file in
   */
  public async getFileIdsByName(filename: string, directoryId: string): Promise<string[]> {
    const result = await this.api.files.list({
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: `mimeType != 'application/vnd.google-apps.folder' and '${directoryId}' in parents and name = '${filename}'`,
      fields: 'nextPageToken, files(id, name)',
      spaces: 'drive'
    });

    if (result?.data?.files?.length) {
      return result.data.files.map(value => value.id as string);
    }

    return [];
  }

  /**
   * Create new Google Sheets file.
   * @param filename
   * @param directoryId
   */
  public async createGoogleSheetsFile(filename: string, directoryId: string): Promise<string | null | undefined> {
    return (await this.api.files.create({
      fields: 'id',
      requestBody: {
        name: filename,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [directoryId]
      }
    }))?.data?.id;
  }

  /**
   * Removes file from the Google Drive.
   * @param id
   */
  public async deleteFile(id: string): Promise<void> {
    await this.api.files.delete({
      fields: 'id',
      fileId: id
    });
  }

  /**
   * Deletes existing files with the specified name from the specified directory.
   * @param filename file name to delete
   * @param directoryId directory to search files in
   */
  public async deleteExistingFiles(filename: string, directoryId: string): Promise<void> {
    const fileIds = await this.getFileIdsByName(filename, directoryId);
    for (const fileId of fileIds ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await this.deleteFile(fileId);
    }
  }

  /**
   * Exports Google Sheets file in XLS format and returns read stream.
   * @param fileId Google Sheets file ID.
   */
  public async exportAsXlsxReadStram(fileId: string): Promise<Readable> {
    const result = await this.api.files.export({
      fileId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }, {responseType: 'stream'});

    return result.data;
  }

  /**
   * Resizes image using google drive.
   * @param readStream
   * @param filename
   * @param directoryId
   * @param maxWidth
   * @param maxHeight
   */
  public async resizeImage(
    readStream: Readable,
    filename: string,
    directoryId: string,
    maxWidth?: number,
    maxHeight?: number
  ): Promise<NodeJS.ReadableStream> {
    const fileId = (await this.api.files.create({
      media: {
        body: readStream
      },
      fields: 'id',
      requestBody: {
        name: filename,
        parents: [directoryId]
      }
    }))?.data?.id;
    if (!fileId) {
      throw new Error('File was not uploaded. File ID is not set.');
    }

    console.log(`File ID: ${fileId}`);

    let thumbnailLink = (await this.api.files.get({
      fileId,
      fields: 'thumbnailLink'
    }))?.data?.thumbnailLink;
    if (!thumbnailLink) {
      throw new Error('Thumbnail link is empty');
    }

    console.log(`Thumbnail Link: ${thumbnailLink}`);

    let szValue = '';
    if (maxWidth && maxHeight) {
      szValue = `w${maxWidth}-h${maxHeight}`;
    } else if (maxWidth) {
      szValue = `w${maxWidth}`;
    } else if (maxHeight) {
      szValue = `h${maxHeight}`;
    }

    if (szValue) {
      thumbnailLink = thumbnailLink.replace(/=s\d+/g, `=${szValue}`);
    }

    console.log('Fetching thumbnail from Google Drive');
    const resultStream = (await fetch(thumbnailLink)).body;

    // Delete file on stream end
    resultStream.on('end', async () => {
      console.log(`Delete file: ${fileId}`);
      await this.deleteFile(fileId);
    });

    return resultStream;
  }
}
