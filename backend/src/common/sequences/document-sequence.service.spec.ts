import { DocumentSequenceCode } from "@prisma/client";
import { DocumentSequenceService } from "./document-sequence.service";

describe("DocumentSequenceService", () => {
  it("formate une référence RC avec padding", async () => {
    const client = {
      documentSequence: {
        update: jest.fn().mockResolvedValue({ prefix: "RC", padding: 6, nextNumber: 42 }),
      },
    };
    const service = new DocumentSequenceService(client as never);
    const reference = await service.nextReference(DocumentSequenceCode.RECEIPT, client as never);
    expect(reference).toBe("RC000041");
    expect(client.documentSequence.update).toHaveBeenCalledWith({
      where: { code: DocumentSequenceCode.RECEIPT },
      data: { nextNumber: { increment: 1 } },
      select: { prefix: true, padding: true, nextNumber: true },
    });
  });
});