import {drive_v3, google} from 'googleapis';
import {drive} from 'googleapis/build/src/apis/drive';
import {GoogleAuth, GoogleAuthOptions, OAuth2Client} from 'google-auth-library';

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
    googleAuthOptions.scopes = googleAuthOptions.scopes ?? ['https://www.googleapis.com/auth/drive.file'];

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
  protected async getFileIdsByName(filename: string, directoryId: string): Promise<string[]> {
    const result = await this.api.files.list({
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
  protected async createGoogleSheetsFile(filename: string, directoryId: string): Promise<string | null | undefined> {
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
  protected async deleteFile(id: string): Promise<void> {
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
  protected async deleteExistingFiles(filename: string, directoryId: string): Promise<void> {
    const fileIds = await this.getFileIdsByName(filename, directoryId);
    for (const fileId of fileIds ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await this.deleteFile(fileId);
    }
  }
}