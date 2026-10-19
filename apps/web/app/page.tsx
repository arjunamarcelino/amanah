import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import { CHAIN_ID, CHAIN_NAME } from "@amanah/shared";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Amanah</h1>
        <Badge variant="secondary">
          {CHAIN_NAME} ({CHAIN_ID})
        </Badge>
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Scaffold ready</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Donor flow, console and ledger land in later prompts.
          </p>
          <Button className="w-fit">Placeholder action</Button>
        </CardContent>
      </Card>
    </main>
  );
}
