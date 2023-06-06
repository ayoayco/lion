import { LionField } from '@lion/ui/form-core.js';
import { LocalizeMixin } from '@lion/ui/localize.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { FileHandle } from './FileHandle.js';
import { LionSelectedFileList } from './LionSelectedFileList.js';
import { localizeNamespaceLoader } from './localizeNamespaceLoader.js';
import { IsAllowedFile } from './validators.js';

/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 * @typedef {import('lit').RenderOptions} RenderOptions
 * @typedef {import('../types/index.js').ModelValueFile} ModelValueFile
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

/**
 * Creates a hash from a File object. This hash can be used as an identifier for a file.
 * @param {File} file
 */
function getIdFromFileHash(file) {
  const { name, lastModified, size, type } = file;
  return (
    JSON.stringify({ name, lastModified, size, type })
      .split('')
      // eslint-disable-next-line no-bitwise
      .reduce((prevHash, currVal) => ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0, 0)
  );
}

/**
 * @param {File} file
 */
export function createModelValueFile(file) {
  /** @type {ModelValueFile} */
  return Object.assign(file, {
    meta: {
      downloadUrl: URL.createObjectURL(file),
      id: getIdFromFileHash(file),
      status: 'staged-for-upload',
    },
  });
}

export class LionInputFile extends ScopedElementsMixin(LocalizeMixin(LionField)) {
  static get properties() {
    return {
      accept: { type: String },
      multiple: { type: Boolean, reflect: true },
      buttonLabel: { type: String, attribute: 'button-label' },
      maxFileSize: { type: Number, attribute: 'max-file-size' },
      enableDropZone: { type: Boolean, attribute: 'enable-drop-zone' },
      uploadOnSelect: { type: Boolean, attribute: 'upload-on-select' },
      _fileSelectResponse: { type: Array, state: true },
      _fileViewList: { type: Array, state: true },
    };
  }

  static scopedElements = {
    ...super.scopedElements,
    'lion-selected-file-list': LionSelectedFileList,
  };

  static localizeNamespaces = [
    { 'lion-input-file': localizeNamespaceLoader },
    ...super.localizeNamespaces,
  ];

  /**
   * @configure ValidateMixin
   */
  static get validationTypes() {
    return ['error', 'info'];
  }

  /**
   * @configure SlotMixin
   */
  get slots() {
    return {
      ...super.slots,
      input: () => html`<input .value="${ifDefined(this.getAttribute('value'))}" />`,
      'file-select-button': () =>
        html`<button
          type="button"
          id="select-button-${this._inputId}"
          @click="${this.__openDialogOnBtnClick}"
        >
          ${this.buttonLabel}
        </button>`,
      'selected-file-list': () => ({
        template: html`
          <lion-selected-file-list
            .fileList=${this._fileViewList}
            .multiple=${this.multiple}
          ></lion-selected-file-list>
        `,
      }),
    };
  }

  /**
   * The helpt text for the input node.
   * When no light dom defined via [slot=help-text], this value will be used
   * @type {string}
   */
  get buttonLabel() {
    return this.__buttonLabel || this._buttonNode?.textContent || '';
  }

  /**
   * @param {string} newValue
   */
  set buttonLabel(newValue) {
    const oldValue = this.buttonLabel;
    /** @type {string} */
    this.__buttonLabel = newValue;
    this.requestUpdate('buttonLabel', oldValue);
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
  get _buttonNode() {
    return this.querySelector(`#select-button-${this._inputId}`);
  }

  /**
   * @protected
   * @configure FocusMixin
   */
  // @ts-ignore
  get _focusableNode() {
    return this._buttonNode;
  }

  constructor() {
    super();

    this.type = 'file';
    this.accept = '';
    this.multiple = false;
    this.uploadOnSelect = false;
    this.enableDropZone = false;
    this.maxFileSize = 524288000;

    /**
     * @type {File[]}
     */
    this.modelValue = [];
    /**
     * @protected
     * @type {EventListener}
     */
    this._onRemoveFile = this._onRemoveFile.bind(this);

    /**
     * @protected
     * @type {ModelValueFile[]}
     */
    this._fileViewList = [];
    /**
     * @protected
     * @type {FileSelectResponse[]}
     */
    // TODO: make readonly?
    this._fileSelectResponse = [];

    // /** @private */
    // this.__duplicateFilesValidator = new HasDuplicateFiles({ show: false });

    /** @private */
    this.__initialFileSelectResponse = this._fileSelectResponse;
  }

  connectedCallback() {
    super.connectedCallback();
    this.__initialFileSelectResponse = this._fileSelectResponse;

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

  /**
   * @configure LocalizeMixin
   */
  onLocaleUpdated() {
    super.onLocaleUpdated();
    // TODO: LocalizeMixin rerenders on locale change, so shouldn't we check for multiple change inside update?
    if (this.multiple) {
      // @ts-ignore
      this.buttonLabel = this.msgLit('lion-input-file:selectTextMultipleFile');
    } else {
      // @ts-ignore
      this.buttonLabel = this.msgLit('lion-input-file:selectTextSingleFile');
    }
  }

  /**
   * Gets all accept criteia (file types, extensions and max file size)
   */
  get _allowedFileCriteria() {
    const { maxFileSize } = this;
    if (!this.accept) {
      return { allowedFileTypes: [], allowedFileExtensions: [], maxFileSize };
    }

    const acceptedFiles = this.accept.replace(/\s+/g, '').replace(/\.+/g, '').split(',');
    const allowedFileTypes = acceptedFiles.filter(acceptedFile => acceptedFile.includes('/'));
    const allowedFileExtensions = acceptedFiles.filter(acceptedFile => !acceptedFile.includes('/'));
    return { allowedFileTypes, allowedFileExtensions, maxFileSize };
  }

  /**
   * @enhance LionField
   * Resets modelValue to initial value.
   * Interaction states are cleared
   */
  reset() {
    super.reset();
    this._fileViewList = [];
    this._fileSelectResponse = this.__initialFileSelectResponse;
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
    this._fileViewList = [];
    this._fileSelectResponse = [];
    this.modelValue = [];
  }

  /**
   * @configure FormatMixin
   * @returns {ModelValueFile[]} parsedValue
   */
  parser() {
    return Array.from(this._inputNode.files || []).map(createModelValueFile);
  }

  /**
   * @configure FormatMixin
   * @param {File[]} v - modelValue: File[]
   * @returns {string} formattedValue
   */
  // eslint-disable-next-line no-unused-vars
  formatter(v) {
    return this._inputNode?.value || '';
  }

  /** @private */
  __setupDragDropEventListeners() {
    // TODO: this will break as soon as a Subclasser changes the template ... (changing class names is allowed, ids should be kept)
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

    this.__setupFileValidators();
    // We need to update our light dom
    this._enhanceSelectedList();

    this._inputNode.type = this.type;
    this._inputNode.tabIndex = -1;
    this._inputNode.multiple = this.multiple;
    this._inputNode.accept = this.accept;

    if (this.enableDropZone) {
      this.__setupDragDropEventListeners();
      // TODO: this can maybe be solved without exposing attrs
      this.setAttribute('drop-zone', '');
    }
  }

  /**
   * @param {import('lit').PropertyValues } changedProperties
   */
  updated(changedProperties) {
    super.updated(changedProperties);

    // TODO: mention code originates from LionInput, but we could not extend from it bc/o x/y/z
    if (changedProperties.has('disabled')) {
      this._inputNode.disabled = this.disabled;
      this.validate();
    }

    if (changedProperties.has('buttonLabel') && this._buttonNode) {
      this._buttonNode.textContent = this.buttonLabel;
    }

    // TODO: mention code originates from LionInput, but we could not extend from it bc/o x/y/z
    if (changedProperties.has('name')) {
      this._inputNode.name = this.name;
    }

    if (changedProperties.has('_ariaLabelledNodes')) {
      this.__syncAriaLabelledByToButton();
    }

    if (changedProperties.has('_ariaDescribedNodes')) {
      this.__syncAriaDescribedByToButton();
    }

    /**
     * Update _fileViewList only if:
     *   1. It is invoked from the file-removed event handler.
     *   2. There is a mismatch between the selected files and files on UI.
     */
    if (changedProperties.has('_fileSelectResponse')) {
      this.__transformFileSelectResponseIntoFilelist();
    }
  }

  __transformFileSelectResponseIntoFilelist() {
    if (this._fileViewList.length === 0) {
      this._fileSelectResponse.forEach(preResponse => {
        const file = {
          systemFile: { name: preResponse.name },
          response: preResponse,
          status: preResponse.status,
          validationFeedback: [{ message: preResponse.errorMessage }],
        };
        // @ts-ignore
        this._fileViewList.push(file);
      });
    }
    this._fileViewList.forEach(file => {
      const hasSameFileInResponse = this._fileSelectResponse.some(
        response => response.name === file.systemFile.name,
      );

      if (!hasSameFileInResponse && this.uploadOnSelect) {
        this.__removeFileFromList(file);
      } else {
        for (const response of this._fileSelectResponse) {
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
            break;
          }
        }
        // this._fileViewList = [...this._fileViewList];
      }
    });
  }

  // TODO: this method also triggers a validator...
  /**
   * @private
   * @param {File[]} fileList
   */
  __computeNewFiles(fileList) {
    const computedFileList = fileList.filter(
      file =>
        this._fileViewList.findIndex(
          existLionFile => existLionFile.systemFile.name === file.name,
        ) === -1,
    );
    // TODO: put this logic in the Validator itself. Changing the param should trigger a re-validate
    // this.__duplicateFileNamesValidator.param = {
    //   show: fileList.length !== computedFileList.length,
    // };

    return computedFileList;
  }

  /**
   * @param {DragEvent} ev
   * @protected
   */
  _processDroppedFiles(ev) {
    ev.preventDefault();
    this.removeAttribute('is-dragging');

    const isDraggingMultipleWhileNotSupported =
      ev.dataTransfer && ev.dataTransfer.items.length > 1 && !this.multiple;
    if (isDraggingMultipleWhileNotSupported || !ev.dataTransfer?.files) {
      return;
    }

    this._inputNode.files = ev.dataTransfer.files;
    // TODO: Normally, FormatMixin would sync modelValue via parser after 'input-value-changed'. Consider this here as well
    this.modelValue = Array.from(ev.dataTransfer.files);
    this._processFiles(ev.dataTransfer.files);
  }

  /**
   * @override
   * @param {Event} ev
   * @protected
   */
  // @ts-expect-error
  _onChange(ev) {
    // Here, we take over the responsibility of InteractionStateMixin, as _leaveEvent is not the best trigger in this case.
    // Giving feedback right after the file dialog is closed results in best UX.
    this.touched = true;
    // Here, we connect ourselves to the FormatMixin flow...
    // TODO: should we call super._onChange(ev) here instead?
    this._onUserInputChanged();
    this._processFiles(/** @type {HTMLInputElement & {files:FileList}} */ (ev.target)?.files);
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
   * @private
   */
  __syncAriaLabelledByToButton() {
    if (this._inputNode.hasAttribute('aria-labelledby')) {
      const ariaLabelledBy = this._inputNode.getAttribute('aria-labelledby');
      this._buttonNode?.setAttribute(
        'aria-labelledby',
        `select-button-${this._inputId} ${ariaLabelledBy}`,
      );
    }
  }

  /**
   * @private
   */
  __syncAriaDescribedByToButton() {
    if (this._inputNode.hasAttribute('aria-describedby')) {
      const ariaDescribedby = this._inputNode.getAttribute('aria-describedby') || '';
      this._buttonNode?.setAttribute('aria-describedby', ariaDescribedby);
    }
  }

  /**
   * @private
   */
  __setupFileValidators() {
    // TODO: update .param when _allowedFileCriteria changes
    this.defaultValidators = [new IsAllowedFile(this._allowedFileCriteria)];
  }

  /**
   * Runs on drag or change event
   *
   * @param {FileList} selectedFiles
   * @protected
   */
  _processFiles(selectedFiles) {
    // file size and type validators are required only when file is selected and not in case of prefill
    // TODO: is this needed every time?
    const newFiles = this.__computeNewFiles(Array.from(selectedFiles));
    if (!newFiles.length) {
      return;
    }

    if (!this.multiple) {
      this._fileViewList = [];
      this._fileSelectResponse = [];
    }

    // Here, we need to:
    // - sync the _inputNode.value (File[]) to .modelValue (ModelValueFile[])
    // - now our validators run on model-value-changed
    // - based on validator outcome, feedback messages get populated automatically

    for (const [i, selectedFile] of newFiles.entries()) {
      const fileHandle = new FileHandle(selectedFile, this._allowedFileCriteria);
      if (fileHandle.failedProp?.length) {
        this._addValidationFeedbackToFile(fileHandle);
        this._fileSelectResponse.push({
          name: fileHandle.systemFile.name,
          status: 'FAIL',
          // @ts-expect-error
          errorMessage: fileHandle.validationFeedback[0].message,
        });
        newFiles.splice(i, 1); // to make sure only the error-free files are sent in the file-list-changed event
      } else {
        this._fileSelectResponse.push({
          name: fileHandle.systemFile.name,
          status: 'SUCCESS',
        });
      }
      this._fileViewList.push(fileHandle);
      this._handleValidationFeedbackVisibility();
    }

    if (newFiles.length > 0) {
      this._dispatchFileListChangeEvent(newFiles);
    }
  }

  /**
   * @param {InputFile[]} newFiles
   * @protected
   */
  _dispatchFileListChangeEvent(newFiles) {
    this.dispatchEvent(
      new CustomEvent('file-list-changed', {
        // TODO: check if composed and bubbles are needed
        // composed: true,
        // bubbles: true,
        detail: {
          newFiles,
        },
      }),
    );
  }

  /**
   * @protected
   */
  _handleValidationFeedbackVisibility() {
    let hasErrors = false;
    this._fileViewList.forEach(fileObj => {
      if (fileObj.failedProp && fileObj.failedProp.length > 0) {
        hasErrors = true;
      }
    });

    // TODO: handle via ValidateMixin (otherwise it breaks as soon as private ValidateMixin internals change)
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
   * @param {FileHandle} fileHandle
   * @protected
   */
  /* eslint-disable no-param-reassign */
  _addValidationFeedbackToFile(fileHandle) {
    fileHandle.validationFeedback = [];
    const { allowedFileExtensions, allowedFileTypes } = this._allowedFileCriteria;
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
      message = this.msgLit('lion-input-file:allowedFileSize', {
        maxSize: formatBytes(this.maxFileSize),
      });
    } else if (!arrayLength) {
      message = this.msgLit('lion-input-file:allowedFileValidatorSimple', {
        allowedType: lastItem,
        maxSize: formatBytes(this.maxFileSize),
      });
    } else {
      message = this.msgLit('lion-input-file:allowedFileValidatorComplex', {
        allowedTypesArray: array.join(', '),
        allowedTypesLastItem: lastItem,
        maxSize: formatBytes(this.maxFileSize),
      });
    }

    const errorObj = {
      message,
      type: 'error',
    };
    fileHandle.validationFeedback?.push(errorObj);
  }

  /**
   * @private
   * @param {InputFile} removedFile
   */
  __removeFileFromList(removedFile) {
    this._fileViewList = this._fileViewList.filter(
      currentFile => currentFile.systemFile.name !== removedFile.systemFile.name,
    );
    // checks if the file is not a pre-filled file
    if (this.modelValue) {
      this.modelValue = this.modelValue.filter(
        (/** @type {InputFile} */ currentFile) => currentFile.name !== removedFile.systemFile.name,
      );
    }
    this._inputNode.value = '';
    this._handleValidationFeedbackVisibility();
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
    if (!this.uploadOnSelect && removedFile) {
      this.__removeFileFromList(removedFile);
    }

    this._removeFile(removedFile);
  }

  // TODO: this doesn't remove the file from the list, but fires an event
  /**
   * @param {InputFile} removedFile
   * @protected
   */
  _removeFile(removedFile) {
    this.dispatchEvent(
      // TODO: check if composed and bubbles are needed
      new CustomEvent('file-removed', {
        // bubbles: true,
        // composed: true,
        detail: {
          removedFile,
          status: removedFile.status,
          _fileSelectResponse: removedFile.response,
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
    return this.modelValue?.length === 0;
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
   * @override FormControlMixin
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
      ${this.enableDropZone
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

  /**
   * @param {MouseEvent} ev
   */
  __openDialogOnBtnClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this._inputNode.click();
  }
}
