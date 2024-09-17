from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import os

def authenticate_gdrive():
    """Authenticate and build Google Drive service using service account."""
    # Specify the required scopes for Google Drive API access
    SCOPES = ['https://www.googleapis.com/auth/drive']

    # Load credentials from the service account file
    creds = service_account.Credentials.from_service_account_file('/google-credentials.json', scopes=SCOPES)

    # Build the Drive API client
    drive_service = build('drive', 'v3', credentials=creds)
    return drive_service

def create_folder_in_drive(folder_name, parent_folder_id, drive_service):
    """Creates a new folder in Google Drive under a specific parent folder."""
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_folder_id]  # Set the parent folder ID
    }
    folder = drive_service.files().create(body=file_metadata, fields='id', supportsAllDrives=True ).execute()
    return folder.get('id')


def upload_file_to_drive(file_path, folder_id, drive_service):
    """Uploads a single file to Google Drive, supporting Shared Drives with streaming."""
    file_metadata = {
        'name': os.path.basename(file_path),
        'parents': [folder_id]
    }

    # Use MediaFileUpload with resumable=True to stream the file during upload
    media = MediaFileUpload(file_path, mimetype='application/octet-stream', resumable=True)

    # Upload the file with supports for Shared Drives
    request = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id',
        supportsAllDrives=True
    )

    # Perform the upload and monitor its progress
    response = None
    while response is None:
        status, response = request.next_chunk()

    print(f'File {file_path} uploaded to Google Drive with ID: {response.get("id")}')

def upload_files_from_directory(directory,folder_id, drive_service):
    """Recursively uploads all files from a directory and its subdirectories to Google Drive."""
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        if os.path.isfile(file_path):
            upload_file_to_drive(file_path,folder_id, drive_service)
        elif os.path.isdir(file_path):
            child_folder = create_folder_in_drive(filename, folder_id, drive_service)
            upload_files_from_directory(file_path, child_folder, drive_service)


if __name__ == "__main__":
    # Authenticate and build Google Drive API service
    drive_service = authenticate_gdrive()

    folder_name = os.getenv('DRIVE_FOLDER_NAME')
    parent_id = os.getenv('DRIVE_PARENT_FOLDER_ID')

    if not folder_name:
        raise ValueError('DRIVE_FOLDER_NAME environment variable is not set.')
    if not parent_id:
        raise ValueError('DRIVE_PARENT_FOLDER_ID environment variable is not set.')

    _folder_id = create_folder_in_drive(folder_name, parent_id, drive_service)
    # Directory where Docker volume is mounted
    out_directory = '/out'

    # Upload all files from the /out directory to Google Drive
    if os.path.exists(out_directory):
        upload_files_from_directory(out_directory,_folder_id, drive_service)
    else:
        print(f"Directory {out_directory} does not exist")
