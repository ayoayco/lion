import { LionField } from '@lion/ui/form-core.js';
import { LocalizeMixin } from '@lion/ui/localize.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { FileHandle, MAX_FILE_SIZE } from './FileHandle.js';
import { LionSelectedFileList } from './LionSelectedFileList.js';
import { localizeNamespaceLoader } from './localizeNamespaceLoader.js';
import { DuplicateFileNames, FileValidation } from './validators.js';

/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('lit').RenderOptions} RenderOptions
 * @typedef {import('../types/input-file.js').InputFile} InputFile
 * @typedef {import('../types/input-file.js').SystemFile} SystemFile
 * @typedef {import('../types/input-file.js').FileSelectResponse} FileSelectResponse
 */

/**
 * @param {number} bytes
 * @param {number} decimals
 */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) {
    return '0 Bytes';
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [' bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))}${sizes[i]}`;
}

export class LionInputFile extends ScopedElementsMixin(LocalizeMixin(LionField)) {
  static get scopedElements() {
    return {
      ...super.scopedElements,
      'lion-selected-file-list': LionSelectedFileList,
    };
  }

  static get properties() {
    return {
      ...super.properties,
      _selectedFilesMetaData: {
        type: Array,
      },
      accept: {
        type: String,
      },
      enableDropZone: {
        type: Boolean,
        attribute: 'enable-drop-zone',
      },
      maxFileSize: {
        type: Number,
        attribute: 'max-file-size',
      },
      multiple: Boolean,
      uploadOnFormSubmit: {
        type: Boolean,
        attribute: 'upload-on-form-submit',
      },
      fileSelectResponse: {
        type: Array,
        attribute: 'file-select-response',
      },
    };
  }

  static localizeNamespaces = [
    { 'lion-input-file': localizeNamespaceLoader },
    ...super.localizeNamespaces,
  ];

  static get validationTypes() {
    return ['error', 'info'];
  }

  /**
   * @configure SlotMixin
   */
  // @ts-ignore
  get slots() {
    return {
      ...super.slots,
      input: () => html`<input .value="${ifDefined(this.getAttribute('value'))}" />`,
      'file-select-button': () => {
        const button = document.createElement('button');
        button.setAttribute('id', `select-button-${this._inputId}`);
        button.setAttribute('type', 'button');
        button.textContent = this.fileSelectButtonLabel;
        button.addEventListener('click', () => this._inputNode.click());
        return button;
      },
      'selected-file-list': () => ({
        template: html`
          <lion-selected-file-list
            .fileList=${this._selectedFilesMetaData}
            .multiple=${this.multiple}
          ></lion-selected-file-list>
        `,
        afterRender: this._enhanceSelectedList(),
      }),
    };
  }

  /**
   * @type {HTMLInputElement}
   * @protected
   */
  get _inputNode() {
    return /** @type {HTMLInputElement} */ (super._inputNode);
  }

  /**
   * @protected
   */
  get _fileSelectButtonNode() {
    return this.querySelector(`#select-button-${this._inputId}`);
  }

  /**
   * The helpt text for the input node.
   * When no light dom defined via [slot=help-text], this value will be used
   * @type {string}
   */
  get fileSelectButtonLabel() {
    return (
      this.__fileSelectButtonLabel ||
      (this._fileSelectButtonNode && this._fileSelectButtonNode.textContent) ||
      ''
    );
  }

  /**
   * @param {string} newValue
   */
  set fileSelectButtonLabel(newValue) {
    const oldValue = this.fileSelectButtonLabel;
    /** @type {string} */
    this.__fileSelectButtonLabel = newValue;
    this.requestUpdate('fileSelectButtonLabel', oldValue);
  }

  /**
   * @protected
   * @configure FocusMixin
   */
  // @ts-ignore
  get _focusableNode() {
    return this._fileSelectButtonNode;
  }

  /**
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  get _isDragAndDropSupported() {
    return 'draggable' in document.createElement('div');
  }

  constructor() {
    super();
    this.type = 'file';
    /**
     * @type {InputFile[]}
     */
    this._selectedFilesMetaData = this._selectedFilesMetaData || [];
    /**
     * @type {FileSelectResponse[]}
     */
    this.fileSelectResponse = [];
    this.__initialFileSelectResponse = this.fileSelectResponse;
    this.uploadOnFormSubmit = true;
    this.multiple = false;
    this.enableDropZone = false;
    this.maxFileSize = MAX_FILE_SIZE;
    this.accept = '';
    /**
     * @type {InputFile[]}
     */
    this.modelValue = [];
    /**
     * @protected
     * @type {EventListener}
     */
    this._onRemoveFile = this._onRemoveFile.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.__initialFileSelectResponse = this.fileSelectResponse;

    this._inputNode.addEventListener('change', this._onChange);
    this._inputNode.addEventListener('click', this._onClick);
    this.addEventListener(
      'file-remove-requested',
      /** @type {EventListener} */ (this._onRemoveFile),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._inputNode.removeEventListener('change', this._onChange);
    this._inputNode.removeEventListener('click', this._onClick);
    this.removeEventListener(
      'file-remove-requested',
      /** @type {EventListener} */ (this._onRemoveFile),
    );
  }

  onLocaleUpdated() {
    super.onLocaleUpdated();
    if (this.multiple) {
      // @ts-ignore
      this.fileSelectButtonLabel = this.msgLit('lion-input-file:selectTextMultipleFile');
    } else {
      // @ts-ignore
      this.fileSelectButtonLabel = this.msgLit('lion-input-file:selectTextSingleFile');
    }
  }

  get fileLimit() {
    /** @type {string[]} */
    let allowedFileTypes = [];
    /** @type {string[]} */
    let allowedFileExtensions = [];
    if (this.accept) {
      const acceptedFiles = this.accept.replace(/\s+/g, '').replace(/\.+/g, '').split(',');
      allowedFileTypes = acceptedFiles.filter(acceptedFile => acceptedFile.includes('/'));
      allowedFileExtensions = acceptedFiles.filter(acceptedFile => !acceptedFile.includes('/'));
    }
    return {
      allowedFileTypes,
      allowedFileExtensions,
      maxFileSize: this.maxFileSize,
    };
  }

  /**
   * Resets modelValue to initial value.
   * Interaction states are cleared
   */
  reset() {
    super.reset();
    this._selectedFilesMetaData = [];
    this.fileSelectResponse = this.__initialFileSelectResponse;
    this.modelValue = [];
    // TODO: find out why it stays dirty
    this.dirty = false;
  }

  /**
   * Clears modelValue.
   * Interaction states are not cleared (use resetInteractionState for this)
   * @override LionField
   */
  clear() {
    this._selectedFilesMetaData = [];
    this.fileSelectResponse = [];
    this.modelValue = [];
  }

  /**
   * override to hide the FileValidation feedback at component level as they are displayed at each file level in file list
   * @param {string} type could be 'error', 'warning', 'info', 'success' or any other custom
   * @param {object} meta meta info (interaction states etc)
   * @protected
   */
  _showFeedbackConditionFor(type, meta) {
    return (
      super._showFeedbackConditionFor(type, meta) &&
      !(
        this.validationStates.error?.FileTypeAllowed || this.validationStates.error?.FileSizeAllowed
      )
    );
  }

  /**
   * @returns {InputFile[]} parsedValue
   */
  parser() {
    // @ts-ignore
    return this._inputNode.files ? Array.from(this._inputNode.files) : [];
  }

  /**
   * @param {InputFile[]} v - modelValue: File[]
   * @returns {string} formattedValue
   */
  // eslint-disable-next-line no-unused-vars
  formatter(v) {
    return this._inputNode?.value || '';
  }

  setupDragDropEventListeners() {
    const dropZone = this.shadowRoot?.querySelector('.input-file__drop-zone');
    ['dragenter', 'dragover', 'dragleave'].forEach(eventName => {
      dropZone?.addEventListener(
        eventName,
        (/** @type {Event} */ ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (eventName !== 'dragleave') {
            this.setAttribute('is-dragging', '');
          } else {
            this.removeAttribute('is-dragging');
          }
        },
        false,
      );
    });

    window.addEventListener(
      'drop',
      ev => {
        if (ev.target === this._inputNode) {
          ev.preventDefault();
        }
        this.removeAttribute('is-dragging');
      },
      false,
    );
  }

  /**
   * @param {import('lit').PropertyValues } changedProperties
   */
  firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);

    if (this._inputNode) {
      this._inputNode.type = this.type;
      this._inputNode.setAttribute('tabindex', '-1');
      this._inputNode.multiple = this.multiple;
      if (this.accept.length) {
        this._inputNode.accept = this.accept;
      }
    }

    if (this.enableDropZone && this._isDragAndDropSupported) {
      this.setupDragDropEventListeners();
      this.setAttribute('drop-zone', '');
    }
  }

  /**
   * @param {import('lit').PropertyValues } changedProperties
   */
  updated(changedProperties) {
    super.updated(changedProperties);

    if (changedProperties.has('disabled')) {
      this._inputNode.disabled = this.disabled;
      this.validate();
    }

    if (changedProperties.has('fileSelectButtonLabel') && this._fileSelectButtonNode) {
      this._fileSelectButtonNode.textContent = this.fileSelectButtonLabel;
    }

    if (changedProperties.has('name')) {
      this._inputNode.name = this.name;
    }

    if (changedProperties.has('_ariaLabelledNodes')) {
      this._syncAriaLabelledByAttributes();
    }

    if (changedProperties.has('_ariaDescribedNodes')) {
      this._syncAriaDescribedByAttributes();
    }

    /**
     * Update _selectedFilesMetaData only if:
     *   1. It is invoked from the file-removed event handler.
     *   2. There is a mismatch between the selected files and files on UI.
     */
    if (changedProperties.has('fileSelectResponse')) {
      if (this.fileSelectResponse.length && this._selectedFilesMetaData.length === 0) {
        this.fileSelectResponse.forEach(preResponse => {
          const file = {
            systemFile: {
              name: preResponse.name,
            },
            response: preResponse,
            status: preResponse.status,
            validationFeedback: [
              {
                message: preResponse.errorMessage,
              },
            ],
          };
          // @ts-ignore
          this._selectedFilesMetaData = [...this._selectedFilesMetaData, file];
        });
      }
      this._selectedFilesMetaData.forEach(file => {
        if (
          !this.fileSelectResponse.some(response => response.name === file.systemFile.name) &&
          !this.uploadOnFormSubmit
        ) {
          this.removeFileFromList(file);
        } else {
          this.fileSelectResponse.forEach(response => {
            if (response.name === file.systemFile.name) {
              // eslint-disable-next-line no-param-reassign
              file.response = response;
              // eslint-disable-next-line no-param-reassign
              file.downloadUrl = response.downloadUrl ? response.downloadUrl : file.downloadUrl;
              // eslint-disable-next-line no-param-reassign
              file.status = response.status;
              // eslint-disable-next-line no-param-reassign
              file.validationFeedback = [
                {
                  type: response.errorMessage?.length > 0 ? 'error' : 'success',
                  message: response.errorMessage,
                },
              ];
            }
          });
          this._selectedFilesMetaData = [...this._selectedFilesMetaData];
        }
      });
      this.requestUpdate();
    }
  }

  /**
   * @param {InputFile[]} fileList
   */
  computeNewAddedFiles(fileList) {
    const computedFileList = fileList.filter(
      file =>
        this._selectedFilesMetaData.findIndex(
          existLionFile => existLionFile.systemFile.name === file.name,
        ) === -1,
    );
    const duplicateFileNamesValidator = this.validators.find(
      vali => vali instanceof DuplicateFileNames,
    );
    if (duplicateFileNamesValidator) {
      if (fileList.length !== computedFileList.length) {
        duplicateFileNamesValidator.param = { show: true };
        this.validate();
      } else {
        duplicateFileNamesValidator.param = { show: false };
        this.validate();
      }
    }
    return computedFileList;
  }

  /**
   * @param {DragEvent} ev
   * @protected
   */
  _processDroppedFiles(ev) {
    ev.preventDefault();
    this.removeAttribute('is-dragging');
    if (ev.dataTransfer && ev.dataTransfer?.items.length > 1 && !this.multiple) {
      return;
    }

    if (ev.dataTransfer?.files) {
      this._inputNode.files = ev.dataTransfer.files;
      // @ts-ignore
      this.modelValue = Array.from(ev.dataTransfer.files);
      // if same file is selected again, e.dataTransfer.files lists that file.
      // So filter if the file already exists
      // @ts-ignore
      const _newFiles = this.computeNewAddedFiles(Array.from(ev.dataTransfer.files));
      if (_newFiles.length > 0) {
        this._processFiles(_newFiles);
      }
    }
  }

  /**
   * @param {Event} ev
   * @protected
   */
  // @ts-ignore
  _onChange(ev) {
    this.touched = true;
    this._onUserInputChanged();
    // @ts-ignore
    this._processFiles(ev.target?.files);
  }

  /**
   * Clear _inputNode.value to make sure onChange is called even for duplicate files
   * @param {Event} ev
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  _onClick(ev) {
    // @ts-ignore
    ev.target.value = ''; // eslint-disable-line no-param-reassign
  }

  /**
   * @protected
   */
  _enhanceSelectedList() {
    /**
     * @type {LionSelectedFileList | null}
     */
    const selectedFileList = this.querySelector('[slot="selected-file-list"]');
    if (selectedFileList) {
      selectedFileList.setAttribute('id', `selected-file-list-${this._inputId}`);
      this.addToAriaDescribedBy(selectedFileList, { idPrefix: 'selected-file-list' });
    }
  }

  /**
   * @protected
   */
  _syncAriaLabelledByAttributes() {
    if (this._inputNode.hasAttribute('aria-labelledby')) {
      const ariaLabelledBy = this._inputNode.getAttribute('aria-labelledby');
      this._fileSelectButtonNode?.setAttribute(
        'aria-labelledby',
        `select-button-${this._inputId} ${ariaLabelledBy}`,
      );
    }
  }

  /**
   * @protected
   */
  _syncAriaDescribedByAttributes() {
    if (this._inputNode.hasAttribute('aria-describedby')) {
      const ariaDescribedby = this._inputNode.getAttribute('aria-describedby') || '';
      this._fileSelectButtonNode?.setAttribute('aria-describedby', ariaDescribedby);
    }
  }

  /**
   * @private
   */
  __setupFileValidators() {
    const { allowedFileTypes, allowedFileExtensions, maxFileSize } = this.fileLimit;

    this.validators = [
      ...this.validators,
      new FileValidation({
        allowedFileTypes,
        allowedFileExtensions,
        maxFileSize,
      }),
      new DuplicateFileNames({ show: false }),
    ];
  }

  /**
   * @param {InputFile[]} selectedFiles
   * @protected
   */
  _processFiles(selectedFiles) {
    // file size and type validators are required only when file is selected and not in case of prefill
    // TODO: is this needed every time?
    this.__setupFileValidators();
    const _newFiles = this.computeNewAddedFiles(Array.from(selectedFiles));
    if (!this.multiple && _newFiles.length > 0) {
      this._selectedFilesMetaData = [];
      this.fileSelectResponse = [];
    }

    /**
     * @type {InputFile}
     */
    let fileObj;
    for (const selectedFile of _newFiles.values()) {
      // @ts-ignore
      fileObj = new FileHandle(selectedFile, this.fileLimit);
      if (fileObj.failedProp && fileObj.failedProp.length > 0) {
        this._handleErroredFiles(fileObj);
        this.fileSelectResponse = [
          ...this.fileSelectResponse,
          {
            name: fileObj.systemFile.name,
            status: 'FAIL',
            // @ts-ignore
            errorMessage: fileObj.validationFeedback[0].message,
          },
        ];
      } else {
        this.fileSelectResponse = [
          ...this.fileSelectResponse,
          {
            name: fileObj.systemFile.name,
            status: 'SUCCESS',
          },
        ];
      }
      this._selectedFilesMetaData = [...this._selectedFilesMetaData, fileObj];
      this._handleErrors();
    }

    // only send error-free files to file-list-changed event
    const _successFiles = this._selectedFilesMetaData.filter(
      ({ systemFile, status }) =>
        _newFiles.includes(/** @type {InputFile} */ (systemFile)) && status === 'SUCCESS',
    );

    if (_successFiles.length > 0) {
      this._dispatchFileListChangeEvent(_successFiles);
    }
  }

  /**
   * @param {InputFile[]} _newFiles
   * @protected
   */
  _dispatchFileListChangeEvent(_newFiles) {
    this.dispatchEvent(
      new CustomEvent('file-list-changed', {
        composed: true,
        bubbles: true,
        detail: {
          newFiles: _newFiles,
        },
      }),
    );
  }

  /**
   * @protected
   */
  _handleErrors() {
    let hasErrors = false;
    this._selectedFilesMetaData.forEach(fileObj => {
      if (fileObj.failedProp && fileObj.failedProp.length > 0) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      this.hasFeedbackFor?.push('error');
      // @ts-ignore use private property
      this.shouldShowFeedbackFor.push('error');
    } else if (this._prevHasErrors && this.hasFeedbackFor.includes('error')) {
      const hasFeedbackForIndex = this.hasFeedbackFor.indexOf('error');
      this.hasFeedbackFor.slice(hasFeedbackForIndex, hasFeedbackForIndex + 1);
      // @ts-ignore use private property
      const shouldShowFeedbackForIndex = this.shouldShowFeedbackFor.indexOf('error');
      // @ts-ignore use private property
      this.shouldShowFeedbackFor.slice(shouldShowFeedbackForIndex, shouldShowFeedbackForIndex + 1);
    }
    this._prevHasErrors = hasErrors;
  }

  /**
   * @param {InputFile} fileObj
   * @protected
   */
  /* eslint-disable no-param-reassign */
  _handleErroredFiles(fileObj) {
    fileObj.validationFeedback = [];
    const { allowedFileExtensions, allowedFileTypes } = this.fileLimit;
    /**
     * @type {string[]}
     */
    let array = [];
    let arrayLength = 0;
    let lastItem;

    if (allowedFileExtensions.length) {
      array = allowedFileExtensions;
      // eslint-disable-next-line no-return-assign
      array = array.map(item => (item = `.${item}`));
      lastItem = array.pop();
      arrayLength = array.length;
    } else if (allowedFileTypes.length) {
      allowedFileTypes.forEach(MIMETypes => {
        if (MIMETypes.endsWith('/*')) {
          array.push(MIMETypes.slice(0, -2));
        } else if (MIMETypes === 'text/plain') {
          array.push('text');
        } else {
          const index = MIMETypes.indexOf('/');
          const subTypes = MIMETypes.slice(index + 1);

          if (!subTypes.includes('+')) {
            array.push(`.${subTypes}`);
          } else {
            const subType = subTypes.split('+');
            array.push(`.${subType[0]}`);
          }
        }
      });
      lastItem = array.pop();
      arrayLength = array.length;
    }
    let message = '';
    if (!lastItem) {
      message = `${this.msgLit('lion-input-file:allowedFileSize', {
        maxSize: formatBytes(this.maxFileSize),
      })}`;
    } else if (!arrayLength) {
      message = `${this.msgLit('lion-input-file:allowedFileValidatorSimple', {
        allowedType: lastItem,
        maxSize: formatBytes(this.maxFileSize),
      })}`;
    } else {
      message = `${this.msgLit('lion-input-file:allowedFileValidatorComplex', {
        allowedTypesArray: array.join(', '),
        allowedTypesLastItem: lastItem,
        maxSize: formatBytes(this.maxFileSize),
      })}`;
    }

    const errorObj = {
      message,
      type: 'error',
    };
    fileObj.validationFeedback?.push(errorObj);
  }

  /**
   * @param {InputFile} removedFile
   */
  removeFileFromList(removedFile) {
    this._selectedFilesMetaData = this._selectedFilesMetaData.filter(
      currentFile => currentFile.systemFile.name !== removedFile.systemFile.name,
    );
    // checks if the file is not a pre-filled file
    if (this.modelValue) {
      this.modelValue = this.modelValue.filter(
        (/** @type {InputFile} */ currentFile) => currentFile.name !== removedFile.systemFile.name,
      );
    }
    this._inputNode.value = '';
    this._handleErrors();
  }

  /**
   * @param {CustomEvent} ev
   * @protected
   */
  _onRemoveFile(ev) {
    if (this.disabled) {
      return;
    }
    const { removedFile } = ev.detail;
    if (this.uploadOnFormSubmit && removedFile) {
      this.removeFileFromList(removedFile);
    }

    this._removeFile(removedFile);
  }

  /**
   * @param {InputFile} removedFile
   * @protected
   */
  _removeFile(removedFile) {
    this.dispatchEvent(
      new CustomEvent('file-removed', {
        bubbles: true,
        composed: true,
        detail: {
          removedFile,
          status: removedFile.status,
          fileSelectResponse: removedFile.response,
        },
      }),
    );
  }

  /**
   * Every time .formattedValue is attempted to sync to the view value (on change/blur and on
   * modelValue change), this condition is checked. In case of the input-file we don't want
   * this sync to happen, since the view value is already correct.
   * @override FormatMixin
   * @return {boolean}
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  _reflectBackOn() {
    return false;
  }

  /**
   * Helper method for the mutually exclusive Required Validator
   * @override ValidateMixin
   */
  _isEmpty() {
    return (
      this.modelValue === null ||
      typeof this.modelValue === 'undefined' ||
      this.modelValue.length === 0
    );
  }

  /**
   * @return {TemplateResult}
   * @protected
   */
  _dropZoneTemplate() {
    return html`
      <div @drop="${this._processDroppedFiles}" class="input-file__drop-zone">
        <div class="input-file__drop-zone__text">
          ${this.msgLit('lion-input-file:dragAndDropText')}
        </div>
        <slot name="file-select-button"></slot>
      </div>
    `;
  }

  /**
   * @return {TemplateResult}
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  _inputGroupAfterTemplate() {
    return html` <slot name="selected-file-list"></slot> `;
  }

  /**
   * @override FormControlMixin
   * @return {TemplateResult}
   * @protected
   */
  _inputGroupInputTemplate() {
    return html`
      <slot name="input"> </slot>
      ${this.enableDropZone && this._isDragAndDropSupported
        ? this._dropZoneTemplate()
        : html`
            <div class="input-group__file-select-button">
              <slot name="file-select-button"></slot>
            </div>
          `}
    `;
  }

  static get styles() {
    return [
      super.styles,
      css`
        .input-group__container {
          position: relative;
          display: flex;
          flex-direction: column;
          width: fit-content;
        }

        :host([drop-zone]) .input-group__container {
          width: auto;
        }

        .input-group__container ::slotted(input[type='file']) {
          /** Invisible, since means of interaction is button */
          position: absolute;
          opacity: 0;
          /** Full cover positioned, so it will be a drag and drop surface */
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .input-file__drop-zone {
          display: flex;
          position: relative;
          flex-direction: column;
          align-items: center;
          border: dashed 2px black;
          padding: 24px 0;
        }
      `,
    ];
  }
}