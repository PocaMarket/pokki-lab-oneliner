import MainLayout from '@/components/Layout/MainLayout'

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; os?: string }>
}) {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <h1 className="text-headline text-gray-800">Pokki Lab</h1>
        <p className="text-body-2 text-gray-500">보일러플레이트가 정상 동작 중입니다.</p>
        <DebugInfo searchParamsPromise={searchParams} />
      </div>
    </MainLayout>
  )
}

async function DebugInfo({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ token?: string; os?: string }>
}) {
  const params = await searchParamsPromise
  return (
    <div className="text-caption-2 text-gray-400 space-y-1 text-center">
      <p>os: {params.os ?? '(없음)'}</p>
      <p>token: {params.token ? `${params.token.slice(0, 10)}…` : '(없음)'}</p>
    </div>
  )
}
