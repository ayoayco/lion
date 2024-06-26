import { Constructor } from '@open-wc/dedupe-mixin';
import { TemplateResult, LitElement } from 'lit';

/**
 * Implicitly creates a wrapper node that allows for rerenders
 */
export type SlotRerenderObject = {
  template: TemplateResult;
  /**
   * Add logic that will be performed after the render
   * @deprecated use regular ReactiveElement/LitElement reactive cycle callbacks instead
   */
  afterRender?: Function;
  /**
   * For backward compat with traditional light render methods,
   * it might be needed to have slot contents available in `connectedCallback`.
   * Only enable this for existing components that rely on light content availability in connectedCallback.
   * For new components, please align with ReactiveElement/LitElement reactive cycle callbacks.
   */
  firstRenderOnConnected?: boolean;
  /**
   * This is recommended to set to true always, as its behavior is usually desired and more in line with slot nodes that
   * are not configured as rerenderable.
   * For backward compatibility, it is set to false by default.
   * When not configured, content is wrapped in a div (this can be problematic for ::slotted css selectors and for
   * querySelectors that expect [slot=x] to have some semantic or (presentational) value).
   */
  renderAsDirectHostChild?: boolean;
};

export type SlotFunctionResult = TemplateResult | Element | SlotRerenderObject | undefined;

declare function slotFunction(): SlotFunctionResult;

export type SlotsMap = {
  [key: string]: typeof slotFunction;
};

export declare class SlotHost {
  /**
   * Obtains all the slots to create
   */
  public get slots(): SlotsMap;

  /**
   * Starts the creation of slots
   */
  protected _connectSlotMixin(): void;

  /**
   * Useful to decide if a given slot should be manipulated depending on if it was auto generated
   * or not.
   *
   * @param {string} slotName Name of the slot
   * @return {boolean} true if given slot name been created by SlotMixin
   */
  protected _isPrivateSlot(slotName: string): boolean;

  connectedCallback(): void;
}

/**
 * # SlotMixin
 *
 * `SlotMixin`, when attached to the DOM it creates content for defined slots in the Light DOM.
 * The content element is created using a factory function and is assigned a slot name from the key.
 * Existing slot content is not overridden.
 *
 * The purpose is to have the default content in the Light DOM rather than hidden in Shadow DOM
 * like default slot content works natively.
 *
 * @example
 * get slots() {
 *   return {
 *     ...super.slots,
 *     // appends <div slot="foo"></div> to the Light DOM of this element
 *     foo: () => document.createElement('div'),
 *   };
 * }
 */
declare function SlotMixinImplementation<T extends Constructor<LitElement>>(
  superclass: T,
): T &
  Constructor<SlotHost> &
  Pick<typeof SlotHost, keyof typeof SlotHost> &
  Pick<typeof LitElement, keyof typeof LitElement>;

export type SlotMixin = typeof SlotMixinImplementation;
