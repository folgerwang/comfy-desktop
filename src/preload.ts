import { app, contextBridge, DownloadItem, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ELECTRON_BRIDGE_API } from './constants';
import { DownloadStatus } from './models/DownloadManager';
import path from 'node:path';

/**
 * Open a folder in the system's default file explorer.
 * @param folderPath The path to the folder to open.
 */
const openFolder = async (folderPath: string) => {
  const basePath = await electronAPI.getBasePath();
  ipcRenderer.send(IPC_CHANNELS.OPEN_PATH, path.join(basePath, folderPath));
};

const electronAPI = {
  /**
   * Callback for progress updates from the main process for starting ComfyUI.
   * @param callback
   */
  onProgressUpdate: (callback: (update: { status: string }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.LOADING_PROGRESS, (_event, value) => {
      console.info(`Received ${IPC_CHANNELS.LOADING_PROGRESS} event`, value);
      callback(value);
    });
  },
  onLogMessage: (callback: (message: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.LOG_MESSAGE, (_event, value) => {
      console.info(`Received ${IPC_CHANNELS.LOG_MESSAGE} event`, value);
      callback(value);
    });
  },
  sendReady: () => {
    console.log('Sending ready event to main process');
    ipcRenderer.send(IPC_CHANNELS.RENDERER_READY);
  },
  isPackaged: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.IS_PACKAGED);
  }, //Emulates app.ispackaged in renderer
  restartApp: (customMessage?: string, delay?: number): void => {
    console.log('Sending restarting app message to main process with custom message: ', customMessage);
    ipcRenderer.send(IPC_CHANNELS.RESTART_APP, { customMessage, delay });
  },
  onShowSelectDirectory: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.SHOW_SELECT_DIRECTORY, () => callback());
  },
  /**
   * Callback for when the user clicks the "Select Directory" button in the setup wizard.
   * @param callback
   */
  selectSetupDirectory: (directory: string) => {
    ipcRenderer.send(IPC_CHANNELS.SELECTED_DIRECTORY, directory);
  },
  openDialog: (options: Electron.OpenDialogOptions) => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIALOG, options);
  },
  onFirstTimeSetupComplete: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.FIRST_TIME_SETUP_COMPLETE, () => callback());
  },
  onDefaultInstallLocation: (callback: (location: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DEFAULT_INSTALL_LOCATION, (_event, value) => {
      console.log(`Received ${IPC_CHANNELS.DEFAULT_INSTALL_LOCATION} event`, value);
      callback(value);
    });
  },
  /**
   * Various paths that are useful to the renderer.
   * - Base path: The base path of the application.
   * - Model config path: The path to the model config yaml file.
   */
  getBasePath: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_BASE_PATH);
  },
  getModelConfigPath: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_MODEL_CONFIG_PATH);
  },
  /**
   * Open various folders in the system's default file explorer.
   */
  openLogsFolder: () => {
    ipcRenderer.send(IPC_CHANNELS.OPEN_PATH, app.getPath('logs'));
  },
  openModelsFolder: () => openFolder('models'),
  openOutputsFolder: () => openFolder('output'),
  openInputsFolder: () => openFolder('input'),
  openCustomNodesFolder: () => openFolder('custom_nodes'),
  openModelConfig: async () => {
    const modelConfigPath = await electronAPI.getModelConfigPath();
    ipcRenderer.send(IPC_CHANNELS.OPEN_PATH, modelConfigPath);
  },
  /**
   * Open the developer tools window.
   */
  openDevTools: () => {
    ipcRenderer.send(IPC_CHANNELS.OPEN_DEV_TOOLS);
  },
  DownloadManager: {
    onDownloadProgress: (
      callback: (progress: {
        url: string;
        progress_percentage: number;
        status: DownloadStatus;
        message?: string;
      }) => void
    ) => {
      ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, (_event, progress) => callback(progress));
    },
    startDownload: (url: string, path: string, filename: string): Promise<boolean> => {
      console.log(`Sending start download message to main process`, { url, path, filename });
      return ipcRenderer.invoke(IPC_CHANNELS.START_DOWNLOAD, { url, path, filename });
    },
    cancelDownload: (url: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DOWNLOAD, url);
    },
    pauseDownload: (url: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PAUSE_DOWNLOAD, url);
    },
    resumeDownload: (url: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.RESUME_DOWNLOAD, url);
    },
    deleteModel: (filename: string, path: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DELETE_MODEL, { filename, path });
    },
    getAllDownloads: (): Promise<DownloadItem[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_DOWNLOADS);
    },
  },
  /**
   * Get the current Electron version
   */
  getElectronVersion: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_ELECTRON_VERSION);
  },
  /**
   * Send an error message to Sentry
   * @param error The error object or message to send
   * @param extras Optional additional context/data to attach
   */
  sendErrorToSentry: (error: string, extras?: Record<string, any>) => {
    return ipcRenderer.invoke(IPC_CHANNELS.SEND_ERROR_TO_SENTRY, {
      error: error,
      extras,
    });
  },
} as const;

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld(ELECTRON_BRIDGE_API, electronAPI);
