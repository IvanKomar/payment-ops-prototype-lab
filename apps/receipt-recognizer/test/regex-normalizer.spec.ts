import { describe, expect, it } from "vitest";

import { RegexNormalizer } from "../src/receipts/normalizers/regex-normalizer.js";

describe("RegexNormalizer", () => {
  const normalizer = new RegexNormalizer();

  it("extracts the Axis Bank PhonePe receipt", async () => {
    const result = await normalizer.normalize(`
Transaction Successful
11:38 pm on 13 March 2026
Paid to
Ansh Anand ₹10,000
Payment details
Banking Name : Ansh Anand
Transaction ID
T21474836471229701068
Debited from
XXXXXXXX621933 ₹10,000
UTR : 429948609046
Powered by UPI AXIS BANK
`);

    expect(result).toMatchObject({
      amount: 10000,
      bank: "Axis Bank",
      currency: "INR",
      recipient: "Ansh Anand",
      sender: "XXXXXXXX621933",
      transactionId: "T21474836471229701068",
      utr: "429948609046",
      normalizedBy: "regex"
    });
    expect(result.transactionDate).toBe("2026-03-13T23:38:00.000Z");
    expect(result.confidence).toBe(1);
  });

  it("extracts the Yes Bank PhonePe receipt", async () => {
    const result = await normalizer.normalize(`
Transaction Successful
12:07 am on 17 Apr 2026
Paid to
Jay Prakash Kumar
XXXXXX9953
Airtel Payments Bank Limited
Banking Name : Jay Prakash Kumar
Transfer Details
Transaction ID
T2604170007543077317626
Debited from
XXXXXXXXXX5536 ₹25,618
UTR: 996178679704
Powered by UPI YES BANK
`);

    expect(result).toMatchObject({
      amount: 25618,
      bank: "Airtel Payments Bank",
      currency: "INR",
      recipient: "Jay Prakash Kumar",
      sender: "XXXXXXXXXX5536",
      transactionId: "T2604170007543077317626",
      utr: "996178679704"
    });
    expect(result.transactionDate).toBe("2026-04-17T00:07:00.000Z");
  });

  it("extracts the ICICI Bank PhonePe receipt", async () => {
    const result = await normalizer.normalize(`
Transaction Successful
03:51 PM on 25 Apr 2026
Paid to
VISHAL ₹13,000
XXXXXXXX6902
HDFC BANK
Banking Name : VISHAL
Transfer Details
Transaction ID
T3748004208605153848062
Debited from
XXXXXXXX7363 ₹13,000
UTR: 423152720207
Powered by UPI ICICI Bank
`);

    expect(result).toMatchObject({
      amount: 13000,
      bank: "HDFC Bank",
      currency: "INR",
      recipient: "VISHAL",
      sender: "XXXXXXXX7363",
      transactionId: "T3748004208605153848062",
      utr: "423152720207"
    });
    expect(result.transactionDate).toBe("2026-04-25T15:51:00.000Z");
  });

  it("handles Tesseract artifacts from the provided Axis fixture", async () => {
    const result = await normalizer.normalize(`
Paid to
e Ansh Anand 10,000
Payment details A
BankingName  : Ansh Anand ¥
Transaction ID
T21474836471229701068 B
Debited from
©) XXXXXXXX621933 10,000
UTR : 429948609046 BD
`);

    expect(result).toMatchObject({
      amount: 10000,
      currency: "INR",
      recipient: "Ansh Anand",
      sender: "XXXXXXXX621933",
      transactionId: "T21474836471229701068",
      utr: "429948609046"
    });
  });

  it("handles Tesseract artifacts from angled PhonePe photos", async () => {
    const result = await normalizer.normalize(`
5] eakngName  :VISHAL © o>
We HOFC BANK Ta
~ T3748004208605153848062 ™ i i
yo» ® XXXXXXXX7363 13,000 Ea
i | UTR: 423152720207 0 ~-
`);

    expect(result).toMatchObject({
      amount: 13000,
      bank: "HDFC Bank",
      recipient: "VISHAL",
      sender: "XXXXXXXX7363",
      transactionId: "T3748004208605153848062",
      utr: "423152720207"
    });
  });
});
