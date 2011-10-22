# multipart-parser

A fast and streaming multipart parser.

## Is it any good?

No, this is still being developed.

## Is it fast?

Yes. According to the benchmark suite shipped with this parser, it is on par
with existing implementations, and can easily exceed typical disk/storage
throughputs.

```
$ node benchmark/benchmark.js
Options:
  Entity Size         : 10 mb
  Chunk Size          : 32 kb
  Runs                : 10
  Iterations per run  : 10

..........

formidable: 747.92 mb/sec (95% of 100 iterations)
multipart_parser: 849.64 mb/sec (95% of 100 iterations)
```

## Is it secure?

Blah.

## Is it compliant?

Blah.

## Is it user friendly?

Blah.

## License

TBD
