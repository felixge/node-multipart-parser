# multipart-parser

A fast and streaming multipart parser.

## Is it any good?

No, this is still being developed.

## Is it fast?

Yes. According to the benchmark suite shipped with this parser, it is on par
with existing implementations, and can easily exceed typical disk/storage
throughputs.

```
$ node --version
v0.4.12
$ node benchmark/benchmark.js -r 100
Options:
  Entity Size         : 10 mb
  Chunk Size          : 32 kb
  Runs                : 100
  Iterations per run  : 10

....................................................................................................
Benchmark took: 33.8 seconds

formidable: 740.47 mb/sec (95% of 1000 iterations)
multipart_parser: 846.75 mb/sec (95% of 1000 iterations)
```

```
$ node --version
v0.5.10-pre
$ node benchmark/benchmark.js -r 100
Options:
  Entity Size         : 10 mb
  Chunk Size          : 32 kb
  Runs                : 100
  Iterations per run  : 10

....................................................................................................
Benchmark took: 33.4 seconds

formidable: 775.19 mb/sec (95% of 1000 iterations)
multipart_parser: 934.58 mb/sec (95% of 1000 iterations)
```

## Is it secure?

Blah.

## Is it compliant?

Blah.

## Is it user friendly?

Blah.

## License

TBD
