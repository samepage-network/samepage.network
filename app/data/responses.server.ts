// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses

/**
 * The server could not understand the request due to invalid syntax.
 */
export class BadRequestResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 400 });
  }
}

/**
 * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated".
 * That is, the client must authenticate itself to get the requested response.
 */
export class UnauthorizedResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 401 });
  }
}

/**
 * This response code is reserved for future use. The initial aim for creating this code was using
 * it for digital payment systems, however this status code is used very rarely and no standard convention exists.
 */
export class PaymentRequiredResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 402 });
  }
}

/**
 * The client does not have access rights to the content; that is, it is unauthorized,
 * so the server is refusing to give the requested resource. Unlike 401 Unauthorized, the client's
 * identity is known to the server.
 */
export class ForbiddenResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 403 });
  }
}

/**
 * The server can not find the requested resource. In the browser, this means the URL is not recognized.
 * In an API, this can also mean that the endpoint is valid but the resource itself does not exist.
 * Servers may also send this response instead of 403 Forbidden to hide the existence of a
 * resource from an unauthorized client. This response code is probably the most well known due to
 * its frequent occurrence on the web.
 */
export class NotFoundResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 404 });
  }
}

/**
 * The request method is known by the server but is not supported by the target resource.
 * For example, an API may not allow calling DELETE to remove a resource.
 */
export class MethodNotAllowedResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 405 });
  }
}

/**
 *  This response is sent when the web server, after performing server-driven content negotiation, doesn't find any content that conforms to the criteria given by the user agent.
 */
export class NotAcceptableResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 406 });
  }
}

/**
 *  This is similar to 401 Unauthorized but authentication is needed to be done by a proxy.
 */
export class ProxyAuthenticationRequiredResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 407 });
  }
}

/**
 *  This response is sent on an idle connection by some servers, even without any previous request by the client. It means that the server would like to shut down this unused connection. This response is used much more since some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing. Also note that some servers merely shut down the connection without sending this message.
 */
export class RequestTimeoutResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 408 });
  }
}

/**
 *  This response is sent when a request conflicts with the current state of the server.
 */
export class ConflictResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 409 });
  }
}

/**
 *  This response is sent when the requested content has been permanently deleted from server, with no forwarding address. Clients are expected to remove their caches and links to the resource. The HTTP specification intends this status code to be used for "limited-time, promotional services". APIs should not feel compelled to indicate resources that have been deleted with this status code.
 */
export class GoneResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 410 });
  }
}

/**
 *  Server rejected the request because the Content-Length header field is not defined and the server requires it.
 */
export class LengthRequiredResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 411 });
  }
}

/**
 *  The client has indicated preconditions in its headers which the server does not meet.
 */
export class PreconditionFailedResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 412 });
  }
}

/**
 *  Request entity is larger than limits defined by server. The server might close the connection or return an Retry-After header field.
 */
export class PayloadTooLargeResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 413 });
  }
}

/**
 *  The URI requested by the client is longer than the server is willing to interpret.
 */
export class URITooLongResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 414 });
  }
}

/**
 *  The media format of the requested data is not supported by the server, so the server is rejecting the request.
 */
export class UnsupportedMediaTypeResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 415 });
  }
}

/**
 *  The range specified by the Range header field in the request cannot be fulfilled. It's possible that the range is outside the size of the target URI's data.
 */
export class RangeNotSatisfiableResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 416 });
  }
}

/**
 *  This response code means the expectation indicated by the Expect request header field cannot be met by the server.
 */
export class ExpectationFailedResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 417 });
  }
}

/**
 *  The server refuses the attempt to brew coffee with a teapot.
 */
export class IAmATeapotResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 418 });
  }
}

/**
 *  The request was directed at a server that is not able to produce a response. This can be sent by a server that is not configured to produce responses for the combination of scheme and authority that are included in the request URI.
 */
export class MisdirectedRequestResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 421 });
  }
}

/**
 *  The request was well-formed but was unable to be followed due to semantic errors.
 */
export class UnprocessableEntityResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 422 });
  }
}

/**
 *  The resource that is being accessed is locked.
 */
export class LockedResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 423 });
  }
}

/**
 *  The request failed due to failure of a previous request.
 */
export class FailedDependencyResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 424 });
  }
}

/**
 *  Indicates that the server is unwilling to risk processing a request that might be replayed.
 */
export class TooEarlyResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 425 });
  }
}

/**
 *  The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol. The server sends an Upgrade header in a 426 response to indicate the required protocol(s).
 */
export class UpgradeRequiredResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 426 });
  }
}

/**
 *  The origin server requires the request to be conditional. This response is intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict.
 */
export class PreconditionRequiredResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 428 });
  }
}

/**
 *  The user has sent too many requests in a given amount of time ("rate limiting").
 */
export class TooManyRequestsResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 429 });
  }
}

/**
 *  The server is unwilling to process the request because its header fields are too large. The request may be resubmitted after reducing the size of the request header fields.
 */
export class RequestHeaderFieldsTooLargeResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 431 });
  }
}

/**
 *  The user agent requested a resource that cannot legally be provided, such as a web page censored by a government.
 */
export class UnavailableForLegalReasonsResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 451 });
  }
}

/**
 * The server has encountered a situation it does not know how to handle.
 */
export class InternalServerResponse extends Response {
  constructor(arg: string) {
    super(arg, { status: 500 });
  }
}
