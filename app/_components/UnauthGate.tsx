export default function UnauthGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6 text-center">
      <h1 className="text-headline text-gray-800">로그인이 필요합니다</h1>
      <p className="text-body-2 text-gray-500">
        포카마켓 앱에서 다시 진입해주세요.
      </p>
    </div>
  )
}
