import '@lion/ui/define/lion-input-file.js';
import { Required } from '@lion/ui/form-core.js';
import { getInputMembers } from '@lion/ui/input-test-helpers.js';
import { expect, fixture as _fixture, html, oneEvent } from '@open-wc/testing';
import sinon from 'sinon';

/**
 * @typedef {import('../src/LionInputFile.js').LionInputFile} LionInputFile
 * @typedef {import('../types/input-file.js').InputFile} InputFile
 * @typedef {import('../types/input-file.js').SystemFile} SystemFile
 * @typedef {import('lit').TemplateResult} TemplateResult
 */
const fixture = /** @type {(arg: TemplateResult|string) => Promise<LionInputFile>} */ (_fixture);

const filesListChanged = (/** @type {LionInputFile} */ el, /** @type { CustomEvent } */ ev) => {
  // eslint-disable-next-line no-param-reassign
  el.fileSelectResponse = [...ev.detail.newFiles];
};

const _mimiSelectFile = (
  /** @type {LionInputFile} */ formControl,
  /** @type {InputFile[]}  */ mockFiles,
) => {
  // @ts-ignore [allow-protected-in-tests]
  formControl._processFiles(mockFiles);
  mockFiles.forEach(file => {
    // @ts-expect-error [allow-protected-in-tests]
    Object.defineProperty(formControl._inputNode, 'value', {
      value: `C:\\fakepath\\${file.name}`,
      writable: true,
    });
  });
  // @ts-expect-error [allow-protected-in-tests]
  Object.defineProperty(formControl._inputNode, 'files', { value: mockFiles, writable: true });
  // @ts-expect-error [allow-protected-in-tests]
  formControl._inputNode.dispatchEvent(new Event('input', { bubbles: true }));
};

const file = /** @type {InputFile} */ (
  new File(['foo'], 'foo.txt', {
    type: 'text/plain',
  })
);
const file2 = /** @type {InputFile} */ (
  new File(['bar'], 'bar.txt', {
    type: 'text/plain',
  })
);
const file3 = /** @type {InputFile} */ (
  new File(['foo3'], 'foo3.txt', {
    type: 'text/plain',
  })
);
const file4 = /** @type {InputFile} */ (
  new File(['foo4'], 'foo4.txt', {
    type: 'text/plain',
  })
);

describe('lion-input-file', () => {
  it('has a type = file', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);
    // @ts-ignore input type="file" is a specific input member
    const { _inputNode } = getInputMembers(el);
    expect(_inputNode.type).to.equal('file');
  });

  it('should add single file and dispatch file-list-changed event with newly added file', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);

    setTimeout(() => {
      _mimiSelectFile(el, [file]);
    });
    const fileListChangedEvent = await oneEvent(el, 'file-list-changed');

    expect(el._selectedFilesMetaData.length).to.equal(1);
    expect(el.fileSelectResponse.length).to.equal(1);

    expect(fileListChangedEvent).to.exist;
    expect(fileListChangedEvent.detail.newFiles.length).to.equal(1);
    expect(fileListChangedEvent.detail.newFiles[0].systemFile.name).to.equal('foo.txt');
  });

  it('should select 1 file', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);
    // @ts-ignore
    const processedFilesSpy = sinon.spy(el, '_processFiles');

    // @ts-ignore
    await el._onChange({ target: { files: [file] } });
    expect(processedFilesSpy).have.been.calledOnce;
    processedFilesSpy.restore();
  });

  it('should retain selected file when "Cancel" button is clicked in system file explorer dialog', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);

    _mimiSelectFile(el, [file]);

    await el.updateComplete;
    expect(el._selectedFilesMetaData.length).to.equal(1);
    expect(el.fileSelectResponse.length).to.equal(1);

    // when cancel is clicked, native input value is blank which means modelValue is blank
    el.modelValue = [];

    await el.updateComplete;
    expect(el._selectedFilesMetaData.length).to.equal(1);
  });

  it('has an attribute focused when focused', async () => {
    const el = await fixture(html` <lion-input-file label="Select"></lion-input-file> `);

    // @ts-ignore [allow-protected-in-tests]
    el._fileSelectButtonNode.focus();
    await el.updateComplete;
    expect(el.hasAttribute('focused')).to.be.true;

    // @ts-ignore [allow-protected-in-tests]
    el._fileSelectButtonNode.blur();
    await el.updateComplete;
    expect(el.hasAttribute('focused')).to.be.false;
  });

  it('should set touched property true on change', async () => {
    const el = await fixture(html` <lion-input-file label="Select"></lion-input-file> `);

    // @ts-ignore
    await el._onChange({ target: { files: [file] } });
    expect(el.touched).to.be.true;
  });

  it('should replace previous file when new file is selected', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);

    _mimiSelectFile(el, [file]);
    await el.updateComplete;
    expect(el._selectedFilesMetaData.length).to.equal(1);
    expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('foo.txt');

    _mimiSelectFile(el, [file2]);
    await el.updateComplete;
    expect(el._selectedFilesMetaData.length).to.equal(1);
    expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('bar.txt');
  });

  context('invalid file types', async () => {
    const fileWrongType = /** @type {InputFile} */ (
      new File(['foobar'], 'foobar.txt', {
        type: 'xxxxx',
      })
    );

    it('should not be added to the selected list', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/plain"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].failedProp?.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].validationFeedback).to.exist;
      expect(el._selectedFilesMetaData[0].status).to.equal('FAIL');
      expect(el.fileSelectResponse[0].status).to.equal('FAIL');
    });

    it('error message should use main type when "/*" is used', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/*"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a(n) text file with max 500MB.');
      });
    });

    it('error message should use main type when "text/plain" is used', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/plain"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a(n) text file with max 500MB.');
      });
    });

    it('error message should use sub type when e.g. "text/html" is used', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/html"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a(n) .html file with max 500MB.');
      });
    });

    it('error message should use the first sub type when e.g. "image/svg+xml" is used', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="image/svg+xml"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a(n) .svg file with max 500MB.');
      });
    });

    it('can reflect multiple types in the error message', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/html, text/csv"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a .html or .csv file with max 500MB.');
      });
    });

    it('can reflect multiple types in the error message also with a space " "', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="text/html,text/csv"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a .html or .csv file with max 500MB.');
      });
    });

    it('can reflect multiple types in the error message with preference to extensions', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept=".jpg,image/svg+xml"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.deep.equal('Please select a(n) .jpg file with max 500MB.');
      });
    });
  });

  context('invalid file extensions', async () => {
    const fileWrongType = /** @type {InputFile} */ (
      new File(['foobar'], 'foobar.txt', {
        type: 'xxxxx',
      })
    );

    it('should not be added to the selected list', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept=".jpg, .png, .pdf"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].failedProp?.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].validationFeedback).to.exist;
      expect(el._selectedFilesMetaData[0].status).to.equal('FAIL');
      expect(el.fileSelectResponse[0].status).to.equal('FAIL');
    });

    it('error message should add the file extension to the validator message', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept=".jpg"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a(n) .jpg file with max 500MB.');
      });
    });

    it('error message should add all file extensions to the validator message', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept=".jpg, .png, .pdf"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a .jpg, .png or .pdf file with max 500MB.');
      });
    });

    it('error message should add all file extensions to the validator message also works without spaces " "', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept=".jpg,.png,.pdf"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a .jpg, .png or .pdf file with max 500MB.');
      });
    });

    it('error message should add all file extensions to the validator message also works without dots "."', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" accept="jpg, png, pdf"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a .jpg, .png or .pdf file with max 500MB.');
      });
    });
  });

  context('invalid file sizes', async () => {
    // Size of this file is 4 bytes
    const fileWrongSize = /** @type {InputFile} */ (new File(['foobar'], 'foobar.txt'));

    it('should not be added to the selected list', async () => {
      const el = await fixture(html` <lion-input-file max-file-size="2"></lion-input-file> `);

      _mimiSelectFile(el, [fileWrongSize]);
      await el.updateComplete;

      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].failedProp?.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].validationFeedback).to.exist;
      expect(el._selectedFilesMetaData[0].status).to.equal('FAIL');
      expect(el.fileSelectResponse[0].status).to.equal('FAIL');
    });

    it('error message should show only the max file size if no type/extension restrictions are defined', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" max-file-size="2"></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongSize]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a file with max 2 bytes.');
      });
    });

    it('error message should show the correct max file size if type/extension restrictions are defined', async () => {
      const el = await fixture(html`
        <lion-input-file
          label="Select"
          max-file-size="2"
          accept=".jpg, .png, .pdf"
        ></lion-input-file>
      `);

      _mimiSelectFile(el, [fileWrongSize]);
      await el.updateComplete;

      el._selectedFilesMetaData[0].validationFeedback?.forEach(error => {
        expect(error.message).to.equal('Please select a .jpg, .png or .pdf file with max 2 bytes.');
      });
    });
  });

  it('should send "file-list-changed" event if selecting files succeeded partially', async () => {
    const el = await fixture(html`<lion-input-file multiple max-file-size="3"></lion-input-file>`);

    // Size of this file is 4 bytes
    const fileWrongSize = /** @type {InputFile} */ (new File(['foobar'], 'foobar.txt'));

    setTimeout(() => {
      _mimiSelectFile(el, [fileWrongSize, file2]);
    });

    const fileListChangedEvent = await oneEvent(el, 'file-list-changed');

    expect(el._selectedFilesMetaData.length).to.equal(2);
    expect(el._selectedFilesMetaData[0].status).to.equal('FAIL');
    expect(el.fileSelectResponse[0].status).to.equal('FAIL');

    expect(fileListChangedEvent.detail.newFiles.length).to.equal(1);
  });

  it('should update downloadurl for successful files', async () => {
    const el = await fixture(html`<lion-input-file></lion-input-file>`);

    setTimeout(() => {
      _mimiSelectFile(el, [file]);
    });
    const fileListChangedEvent = await oneEvent(el, 'file-list-changed');
    filesListChanged(el, fileListChangedEvent);

    expect(el._selectedFilesMetaData[0].downloadUrl).to.exist;
  });

  describe('format', () => {
    it('modelValue is an array of files', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);

      _mimiSelectFile(el, [file]);
      await el.updateComplete;
      expect(el.modelValue).to.deep.equal([file]);
    });

    it('view value is a string', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);

      _mimiSelectFile(el, [file]);
      await el.updateComplete;

      expect(el.value).to.equal('C:\\fakepath\\foo.txt');
      // @ts-expect-error [allow-protected-in-tests]
      expect(el._inputNode.value).to.equal('C:\\fakepath\\foo.txt');
    });

    it('formattedValue is a string', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);

      _mimiSelectFile(el, [file]);
      await el.updateComplete;

      expect(el.formattedValue).to.equal('C:\\fakepath\\foo.txt');
    });

    it('serializedValue is an array of files', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);

      _mimiSelectFile(el, [file]);
      await el.updateComplete;
      expect(el.serializedValue).to.deep.equal([file]);
    });

    it('fires `model-value-changed` for every programmatic modelValue change', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);
      let counter = 0;
      let isTriggeredByUser = false;

      el.addEventListener('model-value-changed', event => {
        counter += 1;
        isTriggeredByUser = /** @type {CustomEvent} */ (event).detail.isTriggeredByUser;
      });

      el.modelValue = [file];
      expect(counter).to.equal(1);
      expect(isTriggeredByUser).to.be.false;

      // TODO: should no change mean no event?
      // el.modelValue = [file];
      // expect(counter).to.equal(1);

      el.modelValue = [file, file2];
      expect(counter).to.equal(2);
    });

    it('fires `model-value-changed` for every user input, adding `isTriggeredByUser` in event detail', async () => {
      const el = await fixture(html` <lion-input-file name="select"></lion-input-file> `);
      let counter = 0;
      let isTriggeredByUser = false;

      el.addEventListener('model-value-changed', event => {
        counter += 1;
        isTriggeredByUser = /** @type {CustomEvent} */ (event).detail.isTriggeredByUser;
      });

      _mimiSelectFile(el, [file]);
      await el.updateComplete;
      expect(counter).to.equal(1);
      expect(isTriggeredByUser).to.be.true;

      _mimiSelectFile(el, [file, file2]);
      await el.updateComplete;
      expect(counter).to.equal(2);
    });
  });

  context('multiple file select', () => {
    it('should add multiple files', async () => {
      const el = await fixture(html`
        <lion-input-file label="Select" .multiple="${true}"> </lion-input-file>
      `);

      _mimiSelectFile(el, [file, file2]);

      await el.updateComplete;
      expect(el._selectedFilesMetaData.length).to.equal(2);
      expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('foo.txt');
      expect(el._selectedFilesMetaData[1].systemFile.name).to.equal('bar.txt');

      expect(el.fileSelectResponse.length).to.equal(2);
      expect(el.fileSelectResponse[0].name).to.equal('foo.txt');
      expect(el.fileSelectResponse[1].name).to.equal('bar.txt');
    });

    it('should add new files and retain previous files', async () => {
      const el = await fixture(html` <lion-input-file .multiple="${true}"></lion-input-file> `);

      setTimeout(() => {
        _mimiSelectFile(el, [file, file2]);
      });
      const fileListChangedEvent = await oneEvent(el, 'file-list-changed');
      filesListChanged(el, fileListChangedEvent);
      await el.updateComplete;

      expect(el._selectedFilesMetaData.length).to.equal(2);

      setTimeout(() => {
        _mimiSelectFile(el, [file3, file4]);
      });
      const fileListChangedEvent1 = await oneEvent(el, 'file-list-changed');
      filesListChanged(el, fileListChangedEvent1);
      await el.updateComplete;
      expect(el._selectedFilesMetaData.length).to.equal(4);
    });

    it('should add multiple files and dispatch file-list-changed event ONLY with newly added file', async () => {
      const el = await fixture(html` <lion-input-file .multiple="${true}"></lion-input-file> `);

      setTimeout(() => {
        _mimiSelectFile(el, [file, file2]);
      });
      const fileListChangedEvent = await oneEvent(el, 'file-list-changed');
      filesListChanged(el, fileListChangedEvent);

      setTimeout(() => {
        _mimiSelectFile(el, [file3, file4]);
      });

      const fileListChangedEvent1 = await oneEvent(el, 'file-list-changed');
      filesListChanged(el, fileListChangedEvent1);

      expect(fileListChangedEvent1).to.exist;
      expect(el._selectedFilesMetaData.length).to.equal(4);
      expect(fileListChangedEvent1.detail.newFiles.length).to.equal(2);
      expect(fileListChangedEvent1.detail.newFiles[0].systemFile.name).to.equal('foo3.txt');
      expect(fileListChangedEvent1.detail.newFiles[1].systemFile.name).to.equal('foo4.txt');
    });

    it('should not allow duplicate files to be selected and show notification message', async () => {
      const el = await fixture(html` <lion-input-file .multiple="${true}"></lion-input-file> `);

      setTimeout(() => {
        _mimiSelectFile(el, [file]);
      });

      // create condition to also show the feedback
      el.prefilled = true;
      const fileListChangedEvent = await oneEvent(el, 'file-list-changed');

      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('foo.txt');

      expect(fileListChangedEvent).to.exist;
      expect(fileListChangedEvent.detail.newFiles.length).to.equal(1);
      expect(fileListChangedEvent.detail.newFiles[0].systemFile.name).to.equal('foo.txt');

      const fileDuplicate = /** @type {InputFile} */ (
        new File(['foo'], 'foo.txt', {
          type: 'text/plain',
        })
      );

      _mimiSelectFile(el, [fileDuplicate]);
      await el.updateComplete;
      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el.hasFeedbackFor).to.deep.equals(['info'], 'hasFeedbackFor');
      expect(el.showsFeedbackFor).to.deep.equals(['info'], 'showsFeedbackFor');
    });

    it('should add valid files and skip invalid ones', async () => {
      const fileWrongSize = /** @type {InputFile} */ (new File(['foobar'], 'foobar.txt'));
      const fileWrongType = /** @type {InputFile} */ (
        new File(['foobar'], 'foobar.txt', {
          type: 'xxxxx',
        })
      );

      const el = await fixture(
        html` <lion-input-file multiple max-file-size="3" accept=".txt"></lion-input-file> `,
      );

      setTimeout(() => {
        _mimiSelectFile(el, [file, fileWrongSize, file2, fileWrongType]);
      });

      const fileListChangedEvent = await oneEvent(el, 'file-list-changed');
      // filesListChanged(el, fileListChangedEvent);

      expect(el._selectedFilesMetaData.length).to.equal(4);
      expect(fileListChangedEvent).to.exist;
      expect(fileListChangedEvent.detail.newFiles.length).to.equal(2);
      expect(fileListChangedEvent.detail.newFiles[0].systemFile.name).to.equal('foo.txt');
      expect(fileListChangedEvent.detail.newFiles[1].systemFile.name).to.equal('bar.txt');
    });
  });

  describe('status and error', () => {
    /**
     * @type {LionInputFile}
     */
    let el;
    beforeEach(async () => {
      el = await fixture(html`<lion-input-file accept="text/plain"></lion-input-file>`);
    });

    it('should set fileSelectResponse data to _selectedFilesMetaData for rendering error and status', async () => {
      _mimiSelectFile(el, [file]);

      el.fileSelectResponse = [{ name: 'foo.txt', status: 'LOADING', errorMessage: '500' }];

      await el.updateComplete;

      expect(el._selectedFilesMetaData[0].status).to.equal('LOADING');
      // @ts-ignore
      expect(el._selectedFilesMetaData[0].validationFeedback[0].message).to.equal('500');
    });

    it('should not fire file-list-changed event if invalid file is selected', async () => {
      const filePdf = /** @type {InputFile} */ (
        new File(['foo'], 'foo.pdf', {
          type: 'application/pdf',
        })
      );
      // @ts-ignore
      const fileListChangedSpy = sinon.spy(el, '_dispatchFileListChangeEvent');

      _mimiSelectFile(el, [filePdf]);

      expect(fileListChangedSpy).have.not.been.called;
      fileListChangedSpy.restore();
    });

    it('updates showFeedbackFor when a wrong file has been added/removed', async () => {
      const fileWrongType = /** @type {InputFile} */ (
        new File(['foobar'], 'foobar.txt', {
          type: 'xxxxx',
        })
      );

      // create condition to also show the feedback
      el.prefilled = true;

      _mimiSelectFile(el, [fileWrongType]);
      await el.updateComplete;
      expect(el.hasFeedbackFor).to.deep.equals(['error'], 'hasFeedbackFor');
      expect(el.showsFeedbackFor).to.deep.equals(['error'], 'showsFeedbackFor');

      // on change the showsFeedbackFor should be empty again
      _mimiSelectFile(el, [file]);
      await el.updateComplete;
      expect(el.hasFeedbackFor).to.deep.equals([]);
      expect(el.showsFeedbackFor).to.deep.equals([]);
    });
  });

  describe('validations when used with lion-form', () => {
    it('should throw error with Required validator', async () => {
      const el = await fixture(html`
        <lion-input-file
          name="myFileInput"
          .validators="${[new Required({}, { getMessage: () => 'FooBar' })]}"
        >
        </lion-input-file>
      `);

      el.touched = true;
      el.dirty = true;
      await el.updateComplete;
      await el.feedbackComplete;
      // @ts-ignore input type="file" is a specific input member
      const { _feedbackNode } = getInputMembers(el);
      expect(_feedbackNode.feedbackData?.[0].message).to.equal('FooBar');
      expect(el.hasFeedbackFor.includes('error')).to.be.true;
    });

    it('reset method should remove File from modelValue but keep fileSelectResponse', async () => {
      const fileSelectResponse = [
        {
          name: 'file1.txt',
          status: 'SUCCESS',
          errorMessage: '',
          downloadUrl: '/downloadFile',
        },
      ];
      const el = await fixture(html`
        <lion-input-file
          label="Select"
          .fileSelectResponse="${fileSelectResponse}"
        ></lion-input-file>
      `);

      _mimiSelectFile(el, [file]);
      await el.updateComplete;

      await el.reset();
      expect(el.modelValue).to.deep.equal([]);
      expect(el._selectedFilesMetaData).to.deep.equal([]);
      expect(el.fileSelectResponse).to.deep.equal(fileSelectResponse);
    });

    it('clear method should remove File from modelValue and fileSelectResponse', async () => {
      const fileSelectResponse = [
        {
          name: 'file1.txt',
          status: 'SUCCESS',
          errorMessage: '',
          downloadUrl: '/downloadFile',
        },
      ];
      const el = await fixture(html`
        <lion-input-file
          label="Select"
          .fileSelectResponse="${fileSelectResponse}"
        ></lion-input-file>
      `);

      setTimeout(() => {
        _mimiSelectFile(el, [file]);
      });
      await oneEvent(el, 'file-list-changed');
      await el.clear();
      expect(el.modelValue).to.deep.equal([]);
      expect(el.fileSelectResponse).to.deep.equal([]);
      expect(el._selectedFilesMetaData).to.deep.equal([]);
    });
  });

  describe('file select component with prefilled state', () => {
    /**
     * @type {LionInputFile}
     */
    let el;
    beforeEach(async () => {
      el = await fixture(html`
        <lion-input-file
          name="myFiles"
          multiple="${true}"
          .fileSelectResponse="${[
            {
              name: 'file1.txt',
              status: 'SUCCESS',
              errorMessage: '',
              downloadUrl: '/downloadFile',
            },
            {
              name: 'file2.txt',
              status: 'FAIL',
              errorMessage: 'something went wrong',
            },
          ]}"
        >
        </lion-input-file>
      `);

      await el.updateComplete;
    });

    it('should update the _selectedFilesMetaData according to fileSelectResponse', () => {
      expect(el._selectedFilesMetaData.length).to.equal(2);
      expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('file1.txt');
      expect(el._selectedFilesMetaData[0].status).to.equal('SUCCESS');
      expect(el._selectedFilesMetaData[0].downloadUrl).to.equal('/downloadFile');
      // @ts-ignore [allow-protected-in-tests]
      expect(el._selectedFilesMetaData[1].validationFeedback[0].message).to.equal(
        'something went wrong',
      );
    });

    it('should remove file on click of cross button', async () => {
      /**
       * @type {Partial<InputFile>}
       */
      const removedFile = {
        name: 'file2.txt',
        status: 'FAIL',
        systemFile: { name: 'file2.txt' },
        response: { name: 'file2.txt', status: 'FAIL' },
      };
      // @ts-ignore
      const removeFileSpy = sinon.spy(el, '_removeFile');

      // assertion for displayed file list to be same
      expect(el._selectedFilesMetaData.length).to.equal(2);
      expect(el._selectedFilesMetaData[1].systemFile.name).to.equal('file2.txt');

      el.dispatchEvent(
        new CustomEvent('file-remove-requested', {
          composed: true,
          bubbles: true,
          detail: {
            removedFile,
            status: removedFile.status,
            fileSelectResponse: removedFile.response,
          },
        }),
      );

      await el.updateComplete;
      expect(removeFileSpy).have.been.calledOnce;
      expect(el._selectedFilesMetaData.length).to.equal(1);
      removeFileSpy.restore();
    });

    it('should fire file-removed event with fileSelectResponse in the details', async () => {
      /**
       * @type {Partial<InputFile>}
       */
      const removedFile = {
        name: 'file2.txt',
        status: 'FAIL',
        systemFile: { name: 'file2.txt' },
        response: { name: 'file2.txt', status: 'FAIL' },
      };

      setTimeout(() => {
        // @ts-ignore ignore file typing
        el._removeFile(removedFile);
      });

      await el.updateComplete;

      const removeFileEvent = await oneEvent(el, 'file-removed');

      // assertion for event data
      expect(removeFileEvent).to.exist;
      expect(removeFileEvent.detail.removedFile).to.deep.equal({
        name: 'file2.txt',
        status: 'FAIL',
        systemFile: {
          name: 'file2.txt',
        },
        response: {
          name: 'file2.txt',
          status: 'FAIL',
        },
      });
      expect(removeFileEvent.detail.status).to.deep.equal('FAIL');
      expect(removeFileEvent.detail.fileSelectResponse).to.deep.equal({
        name: 'file2.txt',
        status: 'FAIL',
      });
    });
  });

  describe('drag and drop', () => {
    /**
     * @type {LionInputFile}
     */
    let el;
    beforeEach(async () => {
      el = await fixture(html`
        <lion-input-file name="myFiles" multiple enable-drop-zone></lion-input-file>
      `);

      await el.updateComplete;
    });

    it('should set "is-dragging" on dragenter', async () => {
      const dropzone = el.shadowRoot?.querySelector('.input-file__drop-zone');
      dropzone?.dispatchEvent(new Event('dragenter', { bubbles: true }));
      expect(el.hasAttribute('is-dragging')).to.equal(true);
    });

    it('should set "is-dragging" on dragover', async () => {
      const dropzone = el.shadowRoot?.querySelector('.input-file__drop-zone');
      dropzone?.dispatchEvent(new Event('dragover', { bubbles: true }));
      expect(el.hasAttribute('is-dragging')).to.equal(true);
    });

    it('should remove "is-dragging" on dragleave', async () => {
      const dropzone = el.shadowRoot?.querySelector('.input-file__drop-zone');
      dropzone?.dispatchEvent(new Event('dragenter', { bubbles: true }));
      await el.updateComplete;

      dropzone?.dispatchEvent(new Event('dragleave', { bubbles: true }));
      expect(el.hasAttribute('is-dragging')).to.equal(false);
    });

    it('should remove "is-dragging" on drop', async () => {
      const dropzone = el.shadowRoot?.querySelector('.input-file__drop-zone');
      dropzone?.dispatchEvent(new Event('dragenter', { bubbles: true }));
      await el.updateComplete;

      window.dispatchEvent(new Event('drop', { bubbles: true }));
      expect(el.hasAttribute('is-dragging')).to.equal(false);
    });

    it('should call _processFiles method', async () => {
      const list = new DataTransfer();
      // @ts-ignore
      list.items.add(file);
      const droppedFiles = list.files;
      // @ts-ignore
      const _processFilesSpy = sinon.spy(el, '_processFiles');

      // @ts-ignore [allow-protected-in-tests]
      await el._processDroppedFiles({
        // @ts-ignore
        dataTransfer: { files: droppedFiles, items: [{ name: 'test.txt' }] },
        preventDefault: () => {},
      });

      expect(_processFilesSpy).have.been.calledOnce;
      _processFilesSpy.restore();
    });
  });

  describe('uploadOnFormSubmit as false', () => {
    it('should not remove file on click of cross button and fire file-removed event', async () => {
      /**
       * @type {Partial<InputFile>}
       */
      const removeFile = {
        name: 'foo.txt',
        status: 'SUCCESS',
        systemFile: { name: 'foo.txt' },
        response: { name: 'foo.txt', status: 'SUCCESS' },
      };

      const el = await fixture(html`
        <lion-input-file .uploadOnFormSubmit="${false}"> </lion-input-file>
      `);

      el.modelValue = [file];
      _mimiSelectFile(el, [file]);

      await el.updateComplete;

      setTimeout(() => {
        // @ts-ignore ignore file typing
        el._removeFile(removeFile);
      });

      const removeFileEvent = await oneEvent(el, 'file-removed');

      // assertion for displayed file list to be same
      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('foo.txt');

      // assertion for event data
      expect(removeFileEvent).to.exist;
      expect(removeFileEvent.detail.removedFile).to.deep.equal({
        name: 'foo.txt',
        status: 'SUCCESS',
        systemFile: {
          name: 'foo.txt',
        },
        response: {
          name: 'foo.txt',
          status: 'SUCCESS',
        },
      });
      expect(removeFileEvent.detail.status).to.deep.equal('SUCCESS');
      expect(removeFileEvent.detail.fileSelectResponse).to.deep.equal({
        name: 'foo.txt',
        status: 'SUCCESS',
      });
    });

    it('should remove file from displayed list if not available in fileSelectResponse array', async () => {
      const el = await fixture(html`
        <lion-input-file
          label="Select"
          .uploadOnFormSubmit="${false}"
          .fileSelectResponse="${[
            {
              name: 'file1.txt',
              status: 'SUCCESS',
              errorMessage: '',
              downloadUrl: '/downloadFile',
            },
            {
              name: 'file2.txt',
              status: 'FAIL',
              errorMessage: 'something went wrong',
            },
          ]}"
        >
        </lion-input-file>
      `);
      await el.updateComplete;
      // assertion for displayed file list to be same
      expect(el._selectedFilesMetaData.length).to.equal(2);
      el.fileSelectResponse = [
        {
          name: 'file1.txt',
          status: 'SUCCESS',
          errorMessage: '',
          downloadUrl: '/downloadFile',
        },
      ];
      await el.updateComplete;
      // assertion for displayed file list to be same
      expect(el._selectedFilesMetaData.length).to.equal(1);
      expect(el._selectedFilesMetaData[0].systemFile.name).to.equal('file1.txt');
      // @ts-expect-error [allow-protected-in-tests]
      expect(el._inputNode.value).to.equal('');
    });
  });

  describe('Accessibility', async () => {
    it('is accessible', async () => {
      const el = await fixture(html`<lion-input-file label="Select"></lion-input-file>`);
      await expect(el).to.be.accessible();
    });

    it('is accessible with an selected file', async () => {
      const fileSelectResponse = [
        {
          name: 'file1.txt',
          status: 'SUCCESS',
          errorMessage: '',
          downloadUrl: '/downloadFile',
        },
      ];
      const el = await fixture(html` <lion-input-file
        label="Select"
        .fileSelectResponse="${fileSelectResponse}"
      ></lion-input-file>`);
      await expect(el).to.be.accessible();
    });

    it('is accessible with an selected file and disabled', async () => {
      const fileSelectResponse = [
        {
          name: 'file1.txt',
          status: 'SUCCESS',
          errorMessage: '',
          downloadUrl: '/downloadFile',
        },
      ];
      const el = await fixture(html`
        <lion-input-file
          label="Select"
          .fileSelectResponse="${fileSelectResponse}"
          disabled
        ></lion-input-file>
      `);
      await expect(el).to.be.accessible();
    });

    describe('has correct aria-roles', async () => {
      it('select-button has aria-labelledby set to itself and the label', async () => {
        const el = await fixture(html` <lion-input-file label="Select"></lion-input-file> `);
        // @ts-ignore [allow-protected-in-tests]
        expect(el._fileSelectButtonNode?.getAttribute('aria-labelledby')).to.contain(
          // @ts-ignore [allow-protected-in-tests]
          `select-button-${el._inputId}`,
        );
        // @ts-ignore [allow-protected-in-tests]
        expect(el._fileSelectButtonNode?.getAttribute('aria-labelledby')).to.contain(
          // @ts-ignore [allow-protected-in-tests]
          `label-${el._inputId}`,
        );
      });

      it('select-button has aria-describedby set to the help-text, selected list and the feedback message', async () => {
        const fileSelectResponse = [
          {
            name: 'file1.txt',
            status: 'SUCCESS',
            errorMessage: '',
            downloadUrl: '/downloadFile',
          },
        ];
        const el = await fixture(html`
          <lion-input-file
            label="Select"
            help-text="foo"
            .fileSelectResponse="${fileSelectResponse}"
          ></lion-input-file>
        `);
        // @ts-ignore [allow-protected-in-tests]
        expect(el._fileSelectButtonNode?.getAttribute('aria-describedby')).to.contain(
          // @ts-ignore [allow-protected-in-tests]
          `help-text-${el._inputId}`,
        );
        // @ts-ignore [allow-protected-in-tests]
        expect(el._fileSelectButtonNode?.getAttribute('aria-describedby')).to.contain(
          // @ts-ignore [allow-protected-in-tests]
          `feedback-${el._inputId}`,
        );
        await el.updateComplete;
        // @ts-ignore [allow-protected-in-tests]
        expect(el._fileSelectButtonNode?.getAttribute('aria-describedby')).to.contain(
          // @ts-ignore [allow-protected-in-tests]
          `selected-file-list-${el._inputId}`,
        );
      });
    });
  });
});