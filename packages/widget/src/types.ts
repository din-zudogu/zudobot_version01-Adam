export interface BotConfig {
  botName:        string;
  welcomeMessage: string;
  widgetColor:    string;
  widgetPosition: "bottom-right" | "bottom-left";
  consentText?:   string;  // optional privacy notice text
  requireConsent: boolean;
}

export interface WidgetOptions {
  embedKey: string;
  apiUrl:   string;
  color:    string;
  position: "bottom-right" | "bottom-left";
}

/** A file that has been validated and uploaded, ready to send with a chat message. */
export interface FileAttachment {
  /** For files ≤5MB: base64-encoded file data (sent inline to Gemini). */
  base64?:  string;
  /** For files 5–10MB: Google Files API URI (sent by reference). */
  fileUri?: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface RecommendedProduct {
  _id?:               string;
  name:               string;
  price:              number;
  priceSuffix:        string;
  description:        string;
  slug:               string;
  imageUrl?:          string;
  productUrl?:        string;
  stripePaymentLink?: string;
  stock?:             number | null;
}
