import { google } from 'googleapis';


const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = 'grandtourdatasets-5295745f7fab.json';


const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });


export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'stream' },
  );
  const chunks = [];
  return await new Promise((resolve, reject) => {
    res.data
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      })
      .on('error', (err) => {
        console.error('Error downloading file.');
        reject(err);
      });
  });
}